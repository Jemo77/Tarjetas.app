import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PlanDto } from './dto/plan.dto.js';
import { MailService } from '../mail/mail.service.js';

const GRACE_DAYS = 5;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  // ------------------------------------------------------------
  // Planes (admin)
  // ------------------------------------------------------------

  async listPlans() {
    const plans = await this.prisma.plan.findMany({ orderBy: { priceCents: 'asc' } });
    return { plans };
  }

  async createPlan(dto: PlanDto) {
    const plan = await this.prisma.plan.create({
      data: {
        code: dto.code,
        name: dto.name,
        priceCents: dto.priceCents,
        currency: dto.currency ?? 'ARS',
        interval: dto.interval ?? 'MONTHLY',
        maxCustomers: dto.maxCustomers ?? null,
        maxStaff: dto.maxStaff ?? null,
        features: (dto.features as unknown as Prisma.InputJsonValue | undefined) ?? {},
        isActive: dto.isActive ?? true,
      },
    });
    return { plan };
  }

  async updatePlan(id: string, dto: PlanDto) {
    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        priceCents: dto.priceCents,
        currency: dto.currency,
        interval: dto.interval,
        maxCustomers: dto.maxCustomers ?? null,
        maxStaff: dto.maxStaff ?? null,
        features: (dto.features as unknown as Prisma.InputJsonValue | undefined) ?? {},
        isActive: dto.isActive,
      },
    });
    return { plan };
  }

  // ------------------------------------------------------------
  // Panel del local
  // ------------------------------------------------------------

  async businessSubscription(establishmentId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { establishmentId },
      include: { plan: true },
    });
    const [customers, staff] = await Promise.all([
      this.prisma.customerStats.count({ where: { establishmentId } }),
      this.prisma.establishmentMember.count({ where: { establishmentId, isActive: true } }),
    ]);
    const plan = subscription?.plan ?? null;
    return {
      subscription: subscription
        ? {
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            externalId: subscription.externalId,
            plan: {
              id: plan?.id,
              name: plan?.name,
              code: plan?.code,
              priceCents: plan?.priceCents,
              currency: plan?.currency,
              interval: plan?.interval,
              maxCustomers: plan?.maxCustomers,
              maxStaff: plan?.maxStaff,
              features: plan?.features,
            },
          }
        : null,
      usage: { customers, staff },
      limits: plan
        ? {
            customers: plan.maxCustomers ?? null,
            staff: plan.maxStaff ?? null,
            customersExceeded: plan.maxCustomers != null && customers > plan.maxCustomers,
            staffExceeded: plan.maxStaff != null && staff > plan.maxStaff,
          }
        : null,
    };
  }

  // ------------------------------------------------------------
  // Webhooks de Mercado Pago (o Stripe, mismo contrato)
  // ------------------------------------------------------------

  async handleWebhook(body: Record<string, unknown>, headers: Record<string, string | string[] | undefined>) {
    const secret = this.config.get<string>('mp.webhookSecret') ?? '';
    if (secret) {
      const signature = this.header(headers, 'x-signature');
      if (!signature || !this.verifySignature(signature, body, secret, headers)) {
        throw new UnauthorizedException({ code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Firma inválida' });
      }
    } else {
      this.logger.warn('MP_WEBHOOK_SECRET no configurado: aceptando webhook sin verificar (solo dev)');
    }

    const type = String(body.type ?? body.action ?? (body as { event?: string }).event ?? '');
    const data = (body.data ?? body) as Record<string, unknown>;
    const externalId = data.id != null ? String(data.id) : undefined;
    let handled = false;

    if (externalId) {
      const statusMap: Record<string, SubscriptionStatus> = {
        subscription_activated: 'ACTIVE',
        subscription_created: 'TRIALING',
        payment_success: 'ACTIVE',
        subscription_payment_success: 'ACTIVE',
        subscription_cancelled: 'CANCELED',
        subscription_paused: 'PAST_DUE',
        subscription_payment_failed: 'PAST_DUE',
        subscription_resumed: 'ACTIVE',
      };
      const nextStatus = statusMap[type];
      if (nextStatus) {
        const subscription = await this.prisma.subscription.findFirst({ where: { externalId } });
        if (subscription) {
          await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: nextStatus, updatedAt: new Date() },
          });
          await this.audit.log({
            establishmentId: subscription.establishmentId,
            action: 'subscription.update',
            entity: 'Subscription',
            entityId: subscription.id,
            metadata: { webhookType: type, externalId, status: nextStatus },
          });
          handled = true;
        }
      }
    }

    this.logger.log(`Webhook MP ${type} handled=${handled}`);
    return { received: true, handled, type };
  }

  private verifySignature(
    signature: string,
    body: Record<string, unknown>,
    secret: string,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    // Formato MP: ts=...;v1=...
    const parts = Object.fromEntries(signature.split(';').map((p) => p.split('=') as [string, string]));
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;
    const requestId = this.header(headers, 'x-request-id') ?? '';
    const dataId = String((body.data as Record<string, unknown> | undefined)?.id ?? '');
    const manifest = `id:${dataId};request-id:${requestId};time-stamp:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  /**
   * Job diario: sincroniza suscripciones vencidas y suspende tras el período
   * de gracia. Se invoca desde JobsService.
   */
  async syncExpired() {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 86400_000);
    const grace = new Date();
    const [, suspended] = await Promise.all([
      this.prisma.$transaction(async (tx) => {
        // PAST_DUE vencido hace más del período de gracia → CANCELED + local SUSPENDED
        const pastDue = await tx.subscription.findMany({
          where: { status: 'PAST_DUE', currentPeriodEnd: { lt: cutoff } },
          select: { id: true, establishmentId: true },
        });
        for (const sub of pastDue) {
          await tx.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELED', cancelAtPeriodEnd: true } });
          await tx.establishment.update({ where: { id: sub.establishmentId }, data: { status: 'SUSPENDED' } });
        }
        // TRIALING vencido: pasar a PAST_DUE (o CANCELED) y avisar
        const trialEnded = await tx.subscription.findMany({
          where: { status: 'TRIALING', trialEndsAt: { lt: grace } },
          select: { id: true, establishmentId: true },
        });
        for (const sub of trialEnded) {
          await tx.subscription.update({ where: { id: sub.id }, data: { status: 'PAST_DUE' } });
        }
      }),
      null,
    ]);
    void suspended;
    return { ok: true };
  }
}