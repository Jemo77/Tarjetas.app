import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CardStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RedeemDto, RedeemPreviewDto } from './dto/redeem.dto.js';

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Busca la tarjeta a canjear sin confirmarlo (para que el staff
   * vea el premio antes de tocar el botón).
   */
  async preview(establishmentId: string, dto: RedeemPreviewDto) {
    const card = await this.findCard(establishmentId, dto, { checkExpiry: true });
    return {
      card: {
        id: card.id,
        cycle: card.cycle,
        rewardTitle: (card.template as unknown as { rewardTitle: string }).rewardTitle ?? 'Premio',
        rewardDescription: (card.template as unknown as { rewardDescription?: string | null }).rewardDescription ?? null,
        customer: card.user ? { id: card.user.id, name: card.user.name, email: card.user.email } : null,
        redeemCode: card.redeemCode,
        completedAt: card.completedAt,
      },
    };
  }

  /**
   * Confirma el canje del premio.
   * El staff escanea el QR (token JWT firmado de 2 min) o tipea el código corto.
   */
  async redeem(establishmentId: string, dto: RedeemDto, actorId: string, ip?: string) {
    const card = await this.findCard(establishmentId, dto, { checkExpiry: true });

    const updated = await this.prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        status: CardStatus.REDEEMED,
        redeemedAt: new Date(),
        redeemedById: actorId,
      },
    });

    await this.prisma.customerStats.upsert({
      where: { userId_establishmentId: { userId: card.userId, establishmentId } },
      create: {
        userId: card.userId,
        establishmentId,
        totalCardsCompleted: 1,
        totalRewardsRedeemed: 1,
        firstStampDate: null,
      },
      update: {
        totalCardsCompleted: { increment: 1 },
        totalRewardsRedeemed: { increment: 1 },
      },
    });

    await this.audit.log({
      actorId,
      establishmentId,
      action: 'card.redeem',
      entity: 'LoyaltyCard',
      entityId: card.id,
      metadata: {
        userId: card.userId,
        rewardTitle: (card.template as unknown as { rewardTitle: string }).rewardTitle,
        redeemCode: card.redeemCode,
      },
      ip,
    });

    return {
      ok: true,
      redeemed: {
        customer: card.user ? { name: card.user.name, email: card.user.email } : null,
        rewardTitle: (card.template as unknown as { rewardTitle: string }).rewardTitle ?? 'Premio',
        code: card.redeemCode,
        redeemedAt: updated.redeemedAt,
      },
    };
  }

  private async findCard(
    establishmentId: string,
    dto: RedeemPreviewDto,
    opts: { checkExpiry: boolean },
  ) {
    let cardId: string | undefined;
    if (dto.token) {
      // QR de canje: JWT de corta vida emitido por /me/cards/:id/redeem-qr
      let payload: { sub: string; cardId: string; purpose: string };
      try {
        payload = await this.jwt.verifyAsync<{ sub: string; cardId: string; purpose: string }>(dto.token);
      } catch {
        throw new UnauthorizedException({ code: 'INVALID_REDEEM_TOKEN', message: 'El QR de canje venció. Pedilo de nuevo.' });
      }
      if (payload.purpose !== 'REDEEM') {
        throw new UnauthorizedException({ code: 'INVALID_REDEEM_TOKEN', message: 'El QR de canje no es válido' });
      }
      cardId = payload.cardId;
    } else if (dto.code) {
      const byCode = await this.prisma.loyaltyCard.findFirst({
        where: { redeemCode: dto.code.toUpperCase(), establishmentId },
      });
      cardId = byCode?.id;
    }

    if (!cardId) {
      throw new NotFoundException({ code: 'CARD_NOT_FOUND', message: 'No se encontró un premio con ese código' });
    }

    const card = await this.prisma.loyaltyCard.findFirst({
      where: { id: cardId, establishmentId },
      include: {
        template: { select: { rewardTitle: true, rewardDescription: true } },
        establishment: { select: { id: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!card) {
      throw new NotFoundException({ code: 'CARD_NOT_FOUND', message: 'No se encontró un premio con ese código' });
    }
    if (card.status !== CardStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'CARD_NOT_COMPLETED',
        message: card.status === CardStatus.REDEEMED ? 'Este premio ya fue canjeado' : 'Este premio no está disponible',
      });
    }
    if (opts.checkExpiry && card.expiresAt && card.expiresAt < new Date()) {
      throw new BadRequestException({ code: 'REWARD_EXPIRED', message: 'El premio venció sin canjearse' });
    }
    return card;
  }
}