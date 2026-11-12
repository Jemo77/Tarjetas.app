import { z } from 'zod';

export const ClaimStampDto = z
  .object({
    token: z.string().min(20, 'Token inválido').max(400),
    src: z.enum(['qr', 'nfc']).optional().default('qr'),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    deviceHash: z.string().max(200).optional(),
  })
  .strict();
export type ClaimStampDto = z.infer<typeof ClaimStampDto>;

export const VoidStampDto = z
  .object({ reason: z.string().trim().min(3, 'Contá el motivo').max(300) })
  .strict();
export type VoidStampDto = z.infer<typeof VoidStampDto>;

export const ManualStampDto = z
  .object({
    userId: z.string().uuid('Cliente inválido'),
    staffId: z.string().uuid().optional(),
    note: z.string().trim().max(200).optional(),
  })
  .strict();
export type ManualStampDto = z.infer<typeof ManualStampDto>;

export const ListStampsQuery = z.object({
  userId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListStampsQuery = z.infer<typeof ListStampsQuery>;