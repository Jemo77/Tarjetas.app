import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  actorId?: string;
  establishmentId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

const SENSITIVE_ACTIONS = new Set([
  'stamp.void',
  'establishment.suspend',
  'establishment.activate',
  'admin.impersonate',
  'card.redeem',
  'stamp.manual',
  'subscription.update',
  'user.anonymize',
]);

/** Registro de acciones sensibles para auditoría (panel de admin). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        establishmentId: entry.establishmentId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        metadata: entry.metadata,
        ip: entry.ip,
      },
    });
  }

  isSensitive(action: string): boolean {
    return SENSITIVE_ACTIONS.has(action);
  }
}