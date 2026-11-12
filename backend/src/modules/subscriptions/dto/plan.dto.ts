import { z } from 'zod';

export const PlanDto = z
  .object({
    id: z.string().uuid().optional(),
    code: z.string().regex(/^[a-z0-9-]{2,30}$/, 'Código con minúsculas y guiones'),
    name: z.string().trim().min(2).max(80),
    priceCents: z.number().int().min(0),
    currency: z.string().length(3).optional().default('ARS'),
    interval: z.enum(['MONTHLY', 'YEARLY']).optional().default('MONTHLY'),
    maxCustomers: z.number().int().min(1).optional().nullable(),
    maxStaff: z.number().int().min(1).optional().nullable(),
    features: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type PlanDto = z.infer<typeof PlanDto>;