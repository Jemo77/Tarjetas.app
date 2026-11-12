import { SetMetadata } from '@nestjs/common';
import { GlobalRole, MemberRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const GLOBAL_ROLES_KEY = 'globalRoles';

/** Roles de membresa del local requeridos (OWNER > MANAGER > STAFF). */
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);

/** Roles globales de plataforma requeridos (p.ej. SUPER_ADMIN). */
export const GlobalRoles = (...roles: GlobalRole[]) =>
  SetMetadata(GLOBAL_ROLES_KEY, roles);