import { z } from 'zod';
import { emailSchema } from '../../auth/dto/auth.dto.js';
import { MemberRole } from '@prisma/client';

export const MemberRoleSchema = z.enum(['OWNER', 'MANAGER', 'STAFF']);

export const CreateMemberDto = z.object({
  email: emailSchema,
  role: MemberRoleSchema.default(MemberRole.STAFF),
}).strict();
export type CreateMemberDto = z.infer<typeof CreateMemberDto>;

export const UpdateMemberDto = z
  .object({
    role: MemberRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateMemberDto = z.infer<typeof UpdateMemberDto>;