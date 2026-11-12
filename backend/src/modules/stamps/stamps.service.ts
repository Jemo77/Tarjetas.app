import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CardStatus, CardTemplate, Establishment, Plan, Prisma, StampSource, StampStatus, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { StampPointsService } from '../stamp-points/stamp-points.service.js';
import { AuditService } from '../audit/audit.service.js';
import { todayInTz } from '../../common/utils/dates.js';
import { distanceMeters } from '../../common/utils/geo.js';
import { generateRedeemCode } from '../../common/utils/tokens.js';
import { ClaimStampDto, ManualStampDto } from './dto/stamp.dto.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class StampsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: StampPointsService,
    private readonly audit: AuditService,
  ) {}

  // ============================================================
  // CLAIM: el corazón del sistema
  // ============================================================

  /**
   * Acredita el sello del día para el usuario autenticado.
   *   1. Valida el punto (token estático o rotativo con HMAC de ventana).
   *   2. Valida local ACTIVE + suscripción TRIALING/ACTIVE.
   *   3. Geofence opcional si el cliente mandó coordenadas.
   *   4. Día calendario en la zona horaria del local.
   *   5. Transacción: busca/o crea la tarjeta del ciclo vigente,
   *      inserta el sello (P2002 → 409 ALREADY_STAMPED_TODAY),
   *      actualiza contadores y CustomerStats.
   */
  async claim(dto: ClaimStampDto, userId: string, ip?: string) {
    const { point } = await this.points.resolveToken(dto.token, ip);

    const establishment = await this.prisma.establishment.findUnique({
      where: { id: point.establishmentId },
    });
    if (!establishment || establishment.deletedAt) {
      throw new NotFoundException({ code: 'INVALID_STAMP_TOKEN', message: 'Local no disponible' });
    }
    await this.assertEligible(establishment);

    // Geofence: solo si el cliente envió coordenadas y el local lo exige
    if (
      establishment.geofenceRadiusM != null &&
      dto.lat != null &&
      dto.lng != null &&
      establishment.latitude != null &&
      establishment.longitude != null
    ) {
      const distance = distanceMeters(dto.lat, dto.lng, Number(establishment.latitude), Number(establishment.longitude));
      if (distance > establishment.geofenceRadiusM) {
        throw new ForbiddenException({ code: 'OUT_OF_RANGE', message: 'Estás fuera del radio del local' });
      }
    }

    const source = dto.src === 'nfc' ? StampSource.NFC : StampSource.QR;

    return this.creditStamp({
      userId,
      establishment,
      pointId: point.id,
      staffId: point.memberId ? point.memberId : null,
      source,
      stampDate: todayInTz(establishment.timezone),
      ipHash: ip ? this.hash(ip) : undefined,
      deviceHash: dto.deviceHash ? this.hash(dto.deviceHash) : undefined,
      latitude: dto.lat,
      longitude: dto.lng,
    });
  }

  /** Carga manual de un sello por parte de un manager (auditado). */
  async manual(establishmentId: string, dto: ManualStampDto, actorId: string, ip?: string) {
    const establishment = await this.prisma.establishment.findUniqueOrThrow({ where: { id: establishmentId } });
    const card = await this.prisma.loyaltyCard.findFirst({
      where: { userId: dto.userId, establishmentId },
    });
    if (!card) {
      throw new BadRequestException({ code: 'CUSTOMER_NOT_FOUND', message: 'El cliente no tiene tarjeta en este local' });
    }

    await this.audit.log({
      actorId,
      establishmentId,
      action: 'stamp.manual',
      entity: 'Stamp',
      metadata: { userId: dto.userId, note: dto.note },
      ip,
    });

    return this.creditStamp({
      userId: dto.userId,
      establishment,
      pointId: undefined,
      staffId: dto.staffId ?? actorId,
      source: StampSource.MANUAL,
      stampDate: todayInTz(establishment.timezone),
      ipHash: ip ? this.hash(ip) : undefined,
      note: dto.note,
    });
  }

  /** Núcleo transaccional compartido por claim y carga manual. */
  private async creditStamp(params: {
    userId: string;
    establishment: Pick<Establishment, 'id' | 'timezone' | 'name'>;
    pointId?: string;
    staffId?: string | null;
    source: StampSource;
    stampDate: Date;
    ipHash?: string;
    deviceHash?: string;
    latitude?: number;
    longitude?: number;
    note?: string;
  }) {
    const { userId, establishment } = params;

    return this.prisma.$transaction(async (tx) => {
      // Límite de clientes del plan
      const plan = await this.planOf(tx, establishment.id);
      if (plan.maxCustomers != null) {
        const customers = await tx.customerStats.count({ where: { establishmentId: establishment.id } });
        if (customers >= plan.maxCustomers) {
          throw new ForbiddenException({
            code: 'PLAN_LIMIT_REACHED',
            message: 'Alcanzaste el máximo de clientes de tu plan. Actualizalo para seguir sumando sellos.',
          });
        }
      }

      // Tarjeta del ciclo vigente (ACTIVE) o nueva del ciclo siguiente
      let card = await tx.loyaltyCard.findFirst({
        where: { userId, establishmentId: establishment.id, status: CardStatus.ACTIVE },
        orderBy: { cycle: 'desc' },
        include: { template: true },
      });

      if (!card) {
        const template = await tx.cardTemplate.findFirst({
          where: { establishmentId: establishment.id, isActive: true },
          orderBy: { version: 'desc' },
        });
        if (!template) {
          throw new BadRequestException({ code: 'NO_ACTIVE_TEMPLATE', message: 'El local no tiene una tarjeta configurada' });
        }
        const lastCycle = await tx.loyaltyCard.findFirst({
          where: { userId, establishmentId: establishment.id },
          orderBy: { cycle: 'desc' },
          select: { cycle: true },
        });
        card = await tx.loyaltyCard.create({
          data: {
            userId,
            establishmentId: establishment.id,
            templateId: template.id,
            cycle: (lastCycle?.cycle ?? 0) + 1,
            stampsRequired: template.stampsRequired,
          },
          include: { template: true },
        });
      }

      // Insertar el sello: la base garantiza 1/día por cliente y local
      let stamp;
      try {
        stamp = await tx.stamp.create({
          data: {
            cardId: card.id,
            userId,
            establishmentId: establishment.id,
            stampPointId: params.pointId,
            staffId: params.staffId ?? undefined,
            stampDate: params.stampDate,
            source: params.source,
            ipHash: params.ipHash,
            deviceHash: params.deviceHash,
            latitude: params.latitude,
            longitude: params.longitude,
            voidReason: params.note,
            stampedAt: new Date(),
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') {
          throw new ConflictException({
            code: 'ALREADY_STAMPED_TODAY',
            message: 'Ya sumaste tu sello de hoy en este local',
          });
        }
        throw error;
      }

      // Actualizar la tarjeta
      const stampsCount = card.stampsCount + 1;
      let status: CardStatus = CardStatus.ACTIVE;
      let redeemCode: string | undefined;
      let completedAt: Date | undefined;
      let expiresAt: Date | null = null;

      if (stampsCount >= card.stampsRequired) {
        status = CardStatus.COMPLETED;
        redeemCode = generateRedeemCode();
        completedAt = new Date();
        if (card.template.rewardValidDays) {
          expiresAt = new Date(completedAt.getTime() + card.template.rewardValidDays * 86400_000);
        }
      }

      const updatedCard = await tx.loyaltyCard.update({
        where: { id: card.id },
        data: { stampsCount, status, redeemCode, completedAt, expiresAt },
        include: {
          template: true,
          establishment: { select: { id: true, name: true, timezone: true } },
        },
      });

      // CustomerStats desnormalizadas
      await tx.customerStats.upsert({
        where: { userId_establishmentId: { userId, establishmentId: establishment.id } },
        create: {
          userId,
          establishmentId: establishment.id,
          totalStamps: 1,
          firstStampDate: params.stampDate,
          lastStampDate: params.stampDate,
        },
        update: {
          totalStamps: { increment: 1 },
          lastStampDate: params.stampDate,
        },
      });

      return {
        stamp: { id: stamp.id, date: stamp.stampDate, source: stamp.source, timestamp: stamp.stampedAt },
        card: {
          id: updatedCard.id,
          cycle: updatedCard.cycle,
          stampsRequired: updatedCard.stampsRequired,
          stampsCount: updatedCard.stampsCount,
          status: updatedCard.status,
          rewardTitle: updatedCard.template.rewardTitle,
          redeemCode: updatedCard.redeemCode,
          completedAt: updatedCard.completedAt,
          expiresAt: updatedCard.expiresAt,
          justCompleted: status === CardStatus.COMPLETED,
        },
        establishment: updatedCard.establishment,
      };
    });
  }

  /** Verifica que el local esté operativo para sumar sellos. */
  private async assertEligible(establishment: Pick<Establishment, 'id' | 'status'>) {
    if (establishment.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: 'ESTABLISHMENT_INACTIVE', message: 'Este local no está activo por ahora' });
    }
    const subscription = await this.prisma.subscription.findUnique({
      where: { establishmentId: establishment.id },
      select: { status: true },
    });
    const active = subscription?.status === 'TRIALING' || subscription?.status === 'ACTIVE';
    if (!active) {
      throw new ForbiddenException({ code: 'ESTABLISHMENT_INACTIVE', message: 'Este local no está activo por ahora' });
    }
  }

  private async planOf(tx: Tx, establishmentId: string): Promise<Plan> {
    const subscription = await tx.subscription.findUnique({
      where: { establishmentId },
      include: { plan: true },
    });
    return subscription?.plan ?? ({ maxCustomers: 50, maxStaff: 5 } as unknown as Plan);
  }

  // ------------------------------------------------------------
  // Gestión del panel
  // ------------------------------------------------------------

  /** Anula un sello (VOIDED). El día queda bloqueado para el cliente. */
  async void(establishmentId: string, stampId: string, reason: string, actorId: string, ip?: string) {
    const stamp = await this.prisma.stamp.findFirst({ where: { id: stampId, establishmentId } });
    if (!stamp) throw new NotFoundException({ code: 'STAMP_NOT_FOUND', message: 'No se encontró el sello' });
    if (stamp.status === StampStatus.VOIDED) {
      throw new BadRequestException({ code: 'ALREADY_VOIDED', message: 'El sello ya está anulado' });
    }
    const updated = await this.prisma.stamp.update({
      where: { id: stamp.id },
      data: { status: StampStatus.VOIDED, voidedAt: new Date(), voidReason: reason },
    });
    await this.audit.log({
      actorId,
      establishmentId,
      action: 'stamp.void',
      entity: 'Stamp',
      entityId: stamp.id,
      metadata: { reason },
      ip,
    });
    return { stamp: updated };
  }

  async list(establishmentId: string, query: { userId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: Prisma.StampWhereInput = {
      establishmentId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            stampDate: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.stamp.findMany({
        where,
        orderBy: { stampedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true } },
          staff: { select: { id: true, name: true } },
        },
      }),
      this.prisma.stamp.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

export type { CardTemplate, Subscription };