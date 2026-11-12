import { z } from 'zod';

export const SignUploadDto = z
  .object({
    filename: z.string().trim().min(1).max(120),
    contentType: z.string().refine((v) => v.startsWith('image/'), 'Debe ser una imagen'),
    purpose: z.enum(['logo', 'background', 'stampIcon']),
  })
  .strict();
export type SignUploadDto = z.infer<typeof SignUploadDto>;

export const WriteUploadDto = z
  .object({
    key: z.string().min(3).max(300),
    contentType: z.string().max(100),
    dataBase64: z.string().min(1),
  })
  .strict();
export type WriteUploadDto = z.infer<typeof WriteUploadDto>;