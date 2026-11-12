import { z } from 'zod';
import { emailSchema } from '../../auth/dto/auth.dto.js';

const coords = z.number().min(-180).max(180);

export const CreateEstablishmentDto = z
  .object({
    name: z.string().trim().min(2, 'Nombre muy corto').max(120),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{2,60}$/, 'Slug con minúsculas, números y guiones')
      .optional(),
    category: z.string().trim().max(60).optional(),
    description: z.string().trim().max(500).optional(),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    province: z.string().trim().max(100).optional(),
    country: z.string().length(2).optional().default('AR'),
    timezone: z.string().trim().max(80).optional(),
    latitude: coords.optional(),
    longitude: coords.optional(),
    geofenceRadiusM: z.number().int().min(0).max(5000).optional().nullable(),
    // Atajos de la tarjeta inicial
    stampsRequired: z.number().int().min(3).max(50).optional(),
    rewardTitle: z.string().trim().min(2).max(120).optional(),
  })
  .strict();
export type CreateEstablishmentDto = z.infer<typeof CreateEstablishmentDto>;

export const UpdateEstablishmentAdminDto = CreateEstablishmentDto.partial().strict();
export type UpdateEstablishmentAdminDto = z.infer<typeof UpdateEstablishmentAdminDto>;

export const UpdateBusinessProfileDto = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    category: z.string().trim().max(60).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    address: z.string().trim().max(200).optional().nullable(),
    city: z.string().trim().max(100).optional().nullable(),
    province: z.string().trim().max(100).optional().nullable(),
    timezone: z.string().trim().max(80).optional(),
    latitude: coords.optional().nullable(),
    longitude: coords.optional().nullable(),
    geofenceRadiusM: z.number().int().min(0).max(5000).optional().nullable(),
    logoUrl: z.string().url().max(1000).optional().nullable(),
    coverUrl: z.string().url().max(1000).optional().nullable(),
  })
  .strict();
export type UpdateBusinessProfileDto = z.infer<typeof UpdateBusinessProfileDto>;

export const InviteOwnerDto = z.object({ email: emailSchema }).strict();
export type InviteOwnerDto = z.infer<typeof InviteOwnerDto>;

export const ListEstablishmentsQuery = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListEstablishmentsQuery = z.infer<typeof ListEstablishmentsQuery>;