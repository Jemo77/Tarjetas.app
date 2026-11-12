import { z } from 'zod';

export const RedeemPreviewDto = z
  .object({
    code: z.string().trim().min(4).max(10).optional(),
    token: z.string().min(10).max(2000).optional(),
  })
  .strict()
  .refine((d) => d.code || d.token, { message: 'Enviá un código o un token' });
export type RedeemPreviewDto = z.infer<typeof RedeemPreviewDto>;

export const RedeemDto = RedeemPreviewDto;
export type RedeemDto = z.infer<typeof RedeemDto>;