import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { GlobalRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { JwtPayload, ActiveUser, AuthenticatedRequest } from '../types/auth.js';

export const ACCESS_COOKIE = 'access_token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { headers: Request['headers']; cookies: Record<string, string> }>();

    const token = this.extractToken(req);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'No hay sesión activa' });
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const user: ActiveUser = {
        userId: payload.sub,
        globalRole: (payload.globalRole ?? GlobalRole.USER) as GlobalRole,
        membership: payload.membership ?? null,
        purpose: payload.purpose,
      };
      req.user = user;
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Sesión inválida o vencida' });
    }
  }

  private extractToken(req: { headers: Request['headers']; cookies: Record<string, string> }): string | null {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return req.cookies?.[ACCESS_COOKIE] ?? null;
  }
}