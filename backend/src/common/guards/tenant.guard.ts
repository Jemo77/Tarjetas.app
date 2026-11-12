import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedRequest } from '../types/auth.js';

/**
 * Inyecta el tenant (establishmentId) desde la membresía del JWT.
 * Ningún endpoint de /business acepta establishmentId por parámetro.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const membership = req.user?.membership;
    if (!membership) {
      throw new ForbiddenException({
        code: 'NO_MEMBERSHIP',
        message: 'Necesitás ser miembro de un establecimiento',
      });
    }
    req.tenant = membership.establishmentId;
    return true;
  }
}