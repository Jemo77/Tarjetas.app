import { z } from 'zod';

export const UpdateStampPointDto = z
  .object({
    validationMode: z.enum(['STATIC', 'ROTATING']).optional(),
    label: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type UpdateStampPointDto = z.infer<typeof UpdateStampPointDto>;