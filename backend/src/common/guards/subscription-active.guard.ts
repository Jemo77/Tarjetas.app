import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { AuthenticatedRequest } from '../types/auth.js';

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Bloquea escrituras del panel cuando la suscripción del local no está
 * TRIALING o ACTIVE. Las lecturas siguen habilitadas.
 */
@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest & { method: Request['method'] }>();
    if (!WRITE_METHODS.includes(req.method)) return true;
    if (!req.tenant) return true;

    const subscription = await this.prisma.subscription.findUnique({
      where: { establishmentId: req.tenant },
      select: { status: true },
    });

    const allowed = subscription?.status === 'TRIALING' || subscription?.status === 'ACTIVE';
    if (!allowed) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_INACTIVE',
        message: 'Tu suscripción no está activa. Revisala en Configuración.',
      });
    }
    return true;
  }
}