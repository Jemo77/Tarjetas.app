import { z } from 'zod';

export const UpdateProfileDto = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(30).optional().nullable(),
    avatarUrl: z.string().url().max(1000).optional().nullable(),
    twoFactorEnabled: z.boolean().optional(),
  })
  .strict();
export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;

export const ChangePasswordDto = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordDto>;