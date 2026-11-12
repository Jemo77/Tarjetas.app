import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberRole } from '@prisma/client';
import { GLOBAL_ROLES_KEY, ROLES_KEY } from '../decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AuthenticatedRequest } from '../types/auth.js';

const ROLE_ORDER: Record<MemberRole, number> = { OWNER: 3, MANAGER: 2, STAFF: 1 };

/**
 * Autoriza por rol de membresía (@Roles) o rol global (@GlobalRoles).
 * Jerarquía del local: OWNER > MANAGER > STAFF.
 * El tenant siempre sale del token (nunca de parámetros del cliente).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const roles = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const globalRoles = this.reflector.getAllAndOverride<string[]>(GLOBAL_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length && !globalRoles?.length) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'No autenticado' });

    // Rol global de plataforma
    if (globalRoles?.length && globalRoles.includes(user.globalRole)) return true;

    // Rol de membresía del local
    if (roles?.length) {
      if (!user.membership) {
        throw new ForbiddenException({ code: 'NO_MEMBERSHIP', message: 'No sos miembro de este establecimiento' });
      }
      const required = Math.max(...roles.map((r) => ROLE_ORDER[r]));
      const granted = ROLE_ORDER[user.membership.memberRole];
      if (granted >= required) return true;
    }

    throw new ForbiddenException({ code: 'FORBIDDEN', message: 'No tenés permisos para esta acción' });
  }
}