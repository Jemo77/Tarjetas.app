import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService, SessionUser } from '../auth/auth.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateProfileDto } from './dto/user.dto.js';
import { sha256Hex } from '../../common/utils/tokens.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async me(userId: string): Promise<{ user: SessionUser }> {
    return this.auth.me(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, ip?: string): Promise<{ user: SessionUser }> {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.twoFactorEnabled !== undefined) data.twoFactorEnabled = dto.twoFactorEnabled;
    await this.prisma.user.update({ where: { id: userId }, data });
    if (dto.twoFactorEnabled !== undefined) {
      await this.audit.log({ actorId: userId, action: 'user.two_factor_changed', entity: 'User', entityId: userId, ip });
    }
    return this.auth.me(userId);
  }

  /** Baja de cuenta: anonimiza los datos personales (soft). */
  async deleteAccount(userId: string, ip?: string): Promise<{ ok: true }> {
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: { actorId: userId, action: 'user.anonymize', entity: 'User', entityId: userId, ip },
      });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      const anonEmail = `anon-${sha256Hex(userId).slice(0, 16)}@deleted.local`;
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonEmail,
          name: null,
          phone: null,
          avatarUrl: null,
          googleId: null,
          isActive: false,
          emailVerified: null,
        },
      });
    });
    return { ok: true };
  }

  // ------------------------------------------------------------
  // Tarjetas del cliente
  // ------------------------------------------------------------

  async myCards(userId: string) {
    const cards = await this.prisma.loyaltyCard.findMany({
      where: { userId, establishment: { deletedAt: null } },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        establishment: {
          select: { id: true, name: true, slug: true, category: true, logoUrl: true, timezone: true },
        },
        template: {
          select: {
            stampsRequired: true,
            rewardTitle: true,
            rewardDescription: true,
            backgroundColor: true,
            backgroundImageUrl: true,
            textColor: true,
            accentColor: true,
            logoUrl: true,
            stampIconKey: true,
            stampIconUrl: true,
            emptySlotStyle: true,
          },
        },
        _count: { select: { stamps: { where: { status: 'VALID' } } } },
      },
    });

    // Agrupo por establecimiento y me quedo con la última tarjeta de cada ciclo activo
    const byEstablishment = new Map<string, typeof cards>();
    for (const card of cards) {
      const list = byEstablishment.get(card.establishmentId) ?? [];
      list.push(card);
      byEstablishment.set(card.establishmentId, list);
    }

    const result = Array.from(byEstablishment.values()).map((group) => {
      const latest = group[0]!;
      const active = group.find((c) => c.status === 'ACTIVE') ?? latest;
      return {
        establishment: latest.establishment,
        template: latest.template,
        cards: group.map((c) => ({
          id: c.id,
          cycle: c.cycle,
          stampsRequired: c.stampsRequired,
          stampsCount: c._count.stamps,
          status: c.status,
          completedAt: c.completedAt,
          expiresAt: c.expiresAt,
          redeemedAt: c.redeemedAt,
          rewardTitle: c.template.rewardTitle,
        })),
        activeCard: {
          id: active.id,
          cycle: active.cycle,
          stampsRequired: active.stampsRequired,
          stampsCount: active._count.stamps,
          status: active.status,
          rewardTitle: active.template.rewardTitle,
          rewardDescription: active.template.rewardDescription,
          completedAt: active.completedAt,
          expiresAt: active.expiresAt,
        },
      };
    });
    return { establishments: result };
  }

  async myCard(userId: string, cardId: string) {
    const card = await this.prisma.loyaltyCard.findFirst({
      where: { id: cardId, userId, establishment: { deletedAt: null } },
      include: {
        establishment: {
          select: { id: true, name: true, slug: true, category: true, logoUrl: true, timezone: true, address: true },
        },
        template: true,
        stamps: { orderBy: { stampedAt: 'desc' } },
      },
    });
    if (!card) {
      throw new NotFoundException({ code: 'CARD_NOT_FOUND', message: 'No se encontró tu tarjeta' });
    }
    return { card };
  }

  /** Token firmado de corta vida (2 min) para mostrar el QR de canje. */
  async redeemQr(userId: string, cardId: string) {
    const card = await this.prisma.loyaltyCard.findFirst({ where: { id: cardId, userId } });
    if (!card) {
      throw new NotFoundException({ code: 'CARD_NOT_FOUND', message: 'No se encontró tu tarjeta' });
    }
    if (card.status !== 'COMPLETED') {
      throw new BadRequestException({ code: 'CARD_NOT_COMPLETED', message: 'La tarjeta todavía no está completa' });
    }
    const appUrl = this.config.get<string>('appUrl') ?? '';
    const token = await this.jwt.signAsync(
      { sub: userId, cardId: card.id, redeemCode: card.redeemCode, purpose: 'REDEEM' },
      { expiresIn: '2m' },
    );
    return {
      token,
      redeemCode: card.redeemCode,
      url: `${appUrl}/panel/redeem?token=${encodeURIComponent(token)}`,
      expiresIn: 120,
    };
  }
}