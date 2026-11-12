import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, ActiveUser, MembershipClaims } from '../types/auth.js';

/** Usuario autenticado completo. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveUser => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user;
  },
);

/** ID del usuario autenticado. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user.userId;
  },
);

/** Tenant actual (establecimiento) inyectado por TenantGuard en rutas /business. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.tenant) {
      throw new Error('TenantGuard no ejecutado en esta ruta');
    }
    return req.tenant;
  },
);

/** Membresía activa del usuario (establishmentId + role). */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MembershipClaims => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user.membership) {
      throw new Error('El usuario no tiene membresía activa');
    }
    return req.user.membership;
  },
);