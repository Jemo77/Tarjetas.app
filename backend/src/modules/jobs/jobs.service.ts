import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CardStatus, CustomerSegment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { daysAgo, daysBetween } from '../../common/utils/dates.js';

export type JobName = 'recompute-segments' | 'expire-rewards' | 'cleanup-auth' | 'winback-emails' | 'subscription-check';

/**
 * Tareas programadas (equivalentes a los workers de BullMQ).
 * Se pueden ejecutar manualmente desde el admin (POST /admin/jobs/:name/run)
 * y en producción se encolan con la frecuencia de la tabla del spec.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async run(name: JobName): Promise<{ job: JobName; ranAt: string; result?: unknown }> {
    this.logger.log(`Ejecutando job ${name}`);
    switch (name) {
      case 'recompute-segments':
        await this.recomputeSegments();
        break;
      case 'expire-rewards':
        await this.expireRewards();
        break;
      case 'cleanup-auth':
        await this.cleanupAuth();
        break;
      case 'winback-emails':
        await this.winbackEmails();
        break;
      case 'subscription-check':
        await this.subscriptionCheck();
        break;
      default:
        throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: `Job desconocido: ${name}` });
    }
    return { job: name, ranAt: new Date().toISOString() };
  }

  // ------------------------------------------------------------
  // recompute-segments (diario 03:00)
  // ------------------------------------------------------------

  async recomputeSegments(establishmentId?: string) {
    const establishments = establishmentId
      ? [{ id: establishmentId }]
      : await this.prisma.establishment.findMany({ where: { deletedAt: null }, select: { id: true } });

    let updated = 0;
    for (const est of establishments) {
      updated += await this.recomputeSegmentsFor(est.id);
    }
    this.logger.log(`Segments actualizados: ${updated} clientes`);
    return { establishments: establishments.length, updated };
  }

  private async recomputeSegmentsFor(establishmentId: string): Promise<number> {
    const stats = await this.prisma.customerStats.findMany({
      where: { establishmentId },
      select: {
        userId: true,
        totalCardsCompleted: true,
        firstStampDate: true,
        lastStampDate: true,
      },
    });

    const today = new Date();
    let updated = 0;
    for (const stat of stats) {
      const stamps = await this.prisma.stamp.findMany({
        where: { userId: stat.userId, establishmentId, status: 'VALID' },
        orderBy: { stampDate: 'asc' },
        select: { stampDate: true },
      });
      const visitsLast30d = stamps.filter((s) => s.stampDate >= daysAgo(30)).length;

      // Días promedio entre visitas consecutivas
      let avgDaysBetweenVisits: number | null = null;
      if (stamps.length >= 2) {
        const diffs: number[] = [];
        for (let i = 1; i < stamps.length; i++) {
          diffs.push(daysBetween(stamps[i - 1]!.stampDate, stamps[i]!.stampDate));
        }
        avgDaysBetweenVisits = Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 100) / 100;
      }

      const segment = computeSegment({
        totalCardsCompleted: stat.totalCardsCompleted,
        visitsLast30d,
        firstStampDate: stat.firstStampDate,
        lastStampDate: stat.lastStampDate,
        today,
      });

      await this.prisma.customerStats.update({
        where: { userId_establishmentId: { userId: stat.userId, establishmentId } },
        data: { visitsLast30d, avgDaysBetweenVisits, segment },
      });
      updated++;
    }
    return updated;
  }

  // ------------------------------------------------------------
  // expire-rewards (diario)
  // ------------------------------------------------------------

  async expireRewards() {
    const result = await this.prisma.loyaltyCard.updateMany({
      where: { status: CardStatus.COMPLETED, expiresAt: { lt: new Date() } },
      data: { status: CardStatus.EXPIRED },
    });
    this.logger.log(`Premios vencidos: ${result.count}`);
    return { expired: result.count };
  }

  // ------------------------------------------------------------
  // cleanup-auth (diario)
  // ------------------------------------------------------------

  async cleanupAuth() {
    const now = new Date();
    const monthAgo = daysAgo(30);
    const [challenges, refreshTokens] = await Promise.all([
      this.prisma.authChallenge.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.refreshToken.deleteMany({ where: { revokedAt: { not: null }, createdAt: { lt: monthAgo } } }),
    ]);
    return { deletedChallenges: challenges.count, deletedTokens: refreshTokens.count };
  }

  // ------------------------------------------------------------
  // winback-emails (semanal) — clientes AT_RISK
  // ------------------------------------------------------------

  async winbackEmails(establishmentIdOverride?: string) {
    const atRisk = await this.prisma.customerStats.findMany({
      where: {
        segment: CustomerSegment.AT_RISK,
        ...(establishmentIdOverride ? { establishmentId: establishmentIdOverride } : {}),
      },
      include: {
        establishment: { select: { id: true, name: true } },
        user: { select: { email: true } },
      },
    });
    let sent = 0;
    // En desarrollo se loguean; en producción se envían solo si el plan lo habilita
    for (const customer of atRisk) {
      await this.mail.sendWinback(customer.user.email, customer.establishment.name, '');
      sent++;
    }
    this.logger.log(`Emails de recuperación: ${sent}`);
    return { sent };
  }

  // ------------------------------------------------------------
  // subscription-check (diario)
  // ------------------------------------------------------------

  async subscriptionCheck() {
    return this.subscriptions.syncExpired();
  }
}

export function computeSegment(params: {
  totalCardsCompleted: number;
  visitsLast30d: number;
  firstStampDate: Date | null;
  lastStampDate: Date | null;
  today: Date;
}): CustomerSegment {
  const { totalCardsCompleted, visitsLast30d, firstStampDate, lastStampDate, today } = params;
  if (totalCardsCompleted >= 2 || visitsLast30d >= 4) return CustomerSegment.LOYAL;
  if (firstStampDate && daysBetween(firstStampDate, today) <= 14) return CustomerSegment.NEW;
  if (lastStampDate && daysBetween(lastStampDate, today) <= 30) return CustomerSegment.ACTIVE;
  if (lastStampDate && daysBetween(lastStampDate, today) <= 60) return CustomerSegment.AT_RISK;
  return CustomerSegment.LOST;
}