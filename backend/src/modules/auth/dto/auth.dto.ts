import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Email inválido').max(254);

export const MagicLinkDto = z.object({ email: emailSchema });
export type MagicLinkDto = z.infer<typeof MagicLinkDto>;

export const VerifyCodeDto = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
  purpose: z.enum(['LOGIN', '2FA']).optional(),
});
export type VerifyCodeDto = z.infer<typeof VerifyCodeDto>;

export const LoginDto = z.object({
  email: emailSchema,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});
export type LoginDto = z.infer<typeof LoginDto>;

export const GoogleLoginDto = z.object({ idToken: z.string().min(10, 'Token de Google inválido') });
export type GoogleLoginDto = z.infer<typeof GoogleLoginDto>;

export const AcceptInvitationDto = z.object({
  token: z.string().min(32, 'Token de invitación inválido'),
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});
export type AcceptInvitationDto = z.infer<typeof AcceptInvitationDto>;

export const SwitchEstablishmentDto = z.object({
  establishmentId: z.string().uuid('Establecimiento inválido'),
});
export type SwitchEstablishmentDto = z.infer<typeof SwitchEstablishmentDto>;

export const ForgotPasswordDto = z.object({ email: emailSchema });
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>;