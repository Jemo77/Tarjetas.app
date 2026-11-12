import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { GlobalRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { GlobalRoles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';

const AuditLogsQuery = z.object({
  action: z.string().max(80).optional(),
  establishmentId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

@ApiTags('admin')
@GlobalRoles(GlobalRole.SUPER_ADMIN)
@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(AuditLogsQuery)) query: z.infer<typeof AuditLogsQuery>) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 30));
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.establishmentId ? { establishmentId: query.establishmentId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, name: true, email: true } },
          establishment: { select: { id: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}