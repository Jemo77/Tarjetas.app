import { GlobalRole, MemberRole } from '@prisma/client';

/** Membresía activa del usuario en un establecimiento (viene del JWT). */
export interface MembershipClaims {
  establishmentId: string;
  memberRole: MemberRole;
}

/** Contenido del JWT de acceso. */
export interface JwtPayload {
  sub: string; // userId
  globalRole: GlobalRole;
  membership: MembershipClaims | null;
  /** propósito especial: redeem token corta vida, impersonación */
  purpose?: 'ACCESS' | 'REDEEM' | 'IMPERSONATE';
  iat?: number;
  exp?: number;
}

/** Usuario autenticado que se inyecta en cada request. */
export interface ActiveUser {
  userId: string;
  globalRole: GlobalRole;
  membership: MembershipClaims | null;
  purpose?: string;
}

export interface AuthenticatedRequest extends Request {
  user: ActiveUser;
  tenant?: string; // establecimiento activo (negocio)
}