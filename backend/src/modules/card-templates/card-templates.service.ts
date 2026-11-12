import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CardTemplateDto, DEFAULT_TEMPLATE } from './dto/card-template.dto.js';

/** Convierte un objeto arbitrario a un valor JSON aceptado por Prisma. */
const jsonAfterUndefined = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === undefined || value === null ? undefined : (value as unknown as Prisma.InputJsonValue);

@Injectable()
export class CardTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(establishmentId: string) {
    let template = await this.prisma.cardTemplate.findFirst({
      where: { establishmentId, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!template) {
      template = await this.prisma.cardTemplate.create({
        data: {
          establishmentId,
          name: 'Tarjeta principal',
          ...DEFAULT_TEMPLATE,
          layout: jsonAfterUndefined(DEFAULT_TEMPLATE.layout),
        },
      });
    }
    return { template };
  }

  async getByEstablishment(establishmentId: string) {
    return this.prisma.cardTemplate.findFirst({
      where: { establishmentId, isActive: true },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Guarda/actualiza el diseño y las reglas. Una sola plantilla activa por
   * local: la actual se desactiva y se crea la nueva versión en la misma
   * transacción (el índice parcial lo garantiza a nivel de base).
   */
  async put(establishmentId: string, dto: CardTemplateDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.cardTemplate.findFirst({
        where: { establishmentId, isActive: true },
        orderBy: { version: 'desc' },
      });
      await tx.cardTemplate.updateMany({
        where: { establishmentId, isActive: true },
        data: { isActive: false },
      });
      const template = await tx.cardTemplate.create({
        data: {
          establishmentId,
          name: dto.name ?? current?.name ?? 'Tarjeta principal',
          version: (current?.version ?? 0) + 1,
          isActive: true,
          stampsRequired: dto.stampsRequired,
          rewardTitle: dto.rewardTitle,
          rewardDescription: dto.rewardDescription ?? undefined,
          rewardValidDays: dto.rewardValidDays ?? undefined,
          logoUrl: dto.logoUrl ?? undefined,
          backgroundColor: dto.backgroundColor,
          backgroundImageUrl: dto.backgroundImageUrl ?? undefined,
          textColor: dto.textColor,
          accentColor: dto.accentColor,
          stampIconKey: dto.stampIconKey ?? undefined,
          stampIconUrl: dto.stampIconUrl ?? undefined,
          emptySlotStyle: dto.emptySlotStyle,
          layout: jsonAfterUndefined(dto.layout),
        },
      });
      return { template };
    });
  }
}