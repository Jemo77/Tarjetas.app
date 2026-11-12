import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EstablishmentStatus, MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { randomToken, hashWithPepper, generateRedeemCode } from '../../common/utils/tokens.js';
import {
  CreateEstablishmentDto,
  InviteOwnerDto,
  UpdateBusinessProfileDto,
  UpdateEstablishmentAdminDto,
} from './dto/establishment.dto.js';
import { parsePagination, paginated } from '../../common/utils/pagination.js';

const TRIAL_DAYS = 14;
export const INVITATION_TTL_DAYS = 7;

@Injectable()
export class EstablishmentsService {
  private readonly pepper: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
  ) {
    this.pepper = process.env.HASH_PEPPER ?? 'dev-pepper';
  }

  // ------------------------------------------------------------
  // Panel del local (perfil)
  // ------------------------------------------------------------

  async myProfile(establishmentId: string) {
    const establishment = await this.prisma.establishment.findUniqueOrThrow({
      where: { id: establishmentId },
    });
    return { establishment };
  }

  async updateProfile(establishmentId: string, dto: UpdateBusinessProfileDto) {
    const establishment = await this.prisma.establishment.update({
      where: { id: establishmentId },
      data: { ...dto },
    });
    return { establishment };
  }

  // ------------------------------------------------------------
  // Admin de plataforma
  // ------------------------------------------------------------

  async list(query: { search?: string; status?: EstablishmentStatus; page?: number; pageSize?: number }) {
    const { page, pageSize, skip, take } = parsePagination(query.page, query.pageSize);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: 'insensitive' as const } }, { slug: { contains: query.search, mode: 'insensitive' as const } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.establishment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          subscription: { include: { plan: { select: { name: true, code: true, priceCents: true } } } },
          _count: {
            select: {
              members: true,
              cards: true,
              stamps: true,
              stats: true,
            },
          },
        },
      }),
      this.prisma.establishment.count({ where }),
    ]);
    return paginated(items, total, page, pageSize);
  }

  /**
   * Alta de un local: crea el establecimiento, la tarjeta por defecto,
   * el punto de sellado (QR) y la suscripción de prueba.
   */
  async create(dto: CreateEstablishmentDto, actorId: string, ip?: string) {
    const slug = dto.slug ?? this.slugify(dto.name);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const establishment = await tx.establishment.create({
          data: {
            name: dto.name,
            slug,
            category: dto.category,
            description: dto.description,
            address: dto.address,
            city: dto.city,
            province: dto.province,
            country: dto.country ?? 'AR',
            timezone: dto.timezone ?? 'America/Argentina/Buenos_Aires',
            latitude: dto.latitude,
            longitude: dto.longitude,
            geofenceRadiusM: dto.geofenceRadiusM,
            status: 'PENDING',
          },
        });

        await tx.cardTemplate.create({
          data: {
            establishmentId: establishment.id,
            name: 'Tarjeta principal',
            stampsRequired: dto.stampsRequired ?? 10,
            rewardTitle: dto.rewardTitle ?? 'Premio del local',
          },
        });

        const token = randomToken(16);
        await tx.stampPoint.create({
          data: {
            establishmentId: establishment.id,
            token,
            label: 'Principal',
            validationMode: 'STATIC',
            secret: randomToken(32),
          },
        });

        const plan = await tx.plan.findFirst({ where: { code: 'pro', isActive: true } });
        await tx.subscription.create({
          data: {
            establishmentId: establishment.id,
            planId: plan?.id ?? (await tx.plan.findFirstOrThrow()).id,
            status: 'TRIALING',
            trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400_000),
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 86400_000),
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            establishmentId: establishment.id,
            action: 'establishment.create',
            entity: 'Establishment',
            entityId: establishment.id,
            ip,
          },
        });

        return { establishment, stampPoint: { token, url: this.pointUrl(token) } };
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Ya existe un local con ese slug. Elegí otro.' });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateEstablishmentAdminDto, actorId: string, ip?: string) {
    try {
      const establishment = await this.prisma.establishment.update({ where: { id }, data: { ...dto } });
      await this.audit.log({ actorId, establishmentId: id, action: 'establishment.update', entity: 'Establishment', entityId: id, ip });
      return { establishment };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Ya existe un local con ese slug.' });
      }
      throw error;
    }
  }

  async setStatus(id: string, status: EstablishmentStatus, actorId: string, ip?: string) {
    const establishment = await this.prisma.establishment.update({ where: { id }, data: { status } });
    await this.audit.log({
      actorId,
      establishmentId: id,
      action: status === 'SUSPENDED' ? 'establishment.suspend' : 'establishment.activate',
      entity: 'Establishment',
      entityId: id,
      ip,
    });
    return { establishment };
  }

  /** Invita al dueño del local por email. */
  async inviteOwner(id: string, dto: InviteOwnerDto, actorId: string, ip?: string, appUrl?: string) {
    const establishment = await this.prisma.establishment.findUniqueOrThrow({ where: { id } });
    const rawToken = randomToken(32);
    const tokenHash = hashWithPepper(rawToken, this.pepper);
    const invitation = await this.prisma.invitation.create({
      data: {
        email: dto.email,
        establishmentId: id,
        role: MemberRole.OWNER,
        tokenHash,
        invitedById: actorId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86400_000),
      },
    });
    const invitationUrl = `${appUrl ?? ''}/accept-invitation?token=${encodeURIComponent(rawToken)}`;
    await this.mail.sendInvitation(dto.email, invitationUrl, establishment.name, 'Dueño');
    await this.audit.log({
      actorId,
      establishmentId: id,
      action: 'invitation.sent',
      entity: 'Invitation',
      entityId: invitation.id,
      metadata: { email: dto.email, role: 'OWNER' },
      ip,
    });
    return {
      ok: true,
      token: rawToken, // solo para dev; NO exponer en producción
      invitationUrl,
      expiresIn: INVITATION_TTL_DAYS * 86400,
    };
  }

  /** Impersonación de soporte: JWT de corta vida con membresía OWNER, siempre auditado. */
  async impersonate(establishmentId: string, actorId: string, ip?: string) {
    const establishment = await this.prisma.establishment.findUniqueOrThrow({ where: { id: establishmentId } });
    const actor = await this.prisma.user.findUniqueOrThrow({ where: { id: actorId } });

    const token = await this.jwt.signAsync(
      {
        sub: actor.id,
        globalRole: actor.globalRole,
        membership: { establishmentId, memberRole: MemberRole.OWNER },
        purpose: 'IMPERSONATE',
      },
      { expiresIn: '1h' },
    );

    await this.audit.log({
      actorId,
      establishmentId,
      action: 'admin.impersonate',
      entity: 'Establishment',
      entityId: establishmentId,
      ip,
    });

    return {
      token,
      establishment: { id: establishment.id, name: establishment.name },
      expiresIn: 3600,
    };
  }

  pointUrl(token: string): string {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    return `${appUrl}/s/${token}?src=qr`;
  }

  static stampToken(): string {
    return randomToken(16);
  }

  static redeemCode(): string {
    return generateRedeemCode();
  }

  private slugify(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return `${base || 'local'}-${randomToken(3)}`;
  }
}