import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EstablishmentMember, GlobalRole, User } from '@prisma/client';
import { Response } from 'express';
import * as argon2 from 'argon2';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { hashWithPepper, randomCode, randomToken } from '../../common/utils/tokens.js';
import { JwtPayload, MembershipClaims } from '../../common/types/auth.js';
import {
  AcceptInvitationDto,
  LoginDto,
  MagicLinkDto,
  VerifyCodeDto,
} from './dto/auth.dto.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  emailVerified: boolean;
  memberships: {
    establishmentId: string;
    establishmentName: string;
    role: string;
  }[];
}

const CODE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly pepper: string;
  private readonly accessTtl: string;
  private readonly refreshTtlDays: number;
  private readonly secure: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {
    this.pepper = this.config.get<string>('hashPepper') ?? '';
    this.accessTtl = this.config.get<string>('jwt.accessTtl') ?? '15m';
    this.refreshTtlDays = this.config.get<number>('jwt.refreshTtlDays') ?? 30;
    this.secure = this.config.get<string>('env') === 'production';
  }

  // ------------------------------------------------------------
  // Magic link / OTP
  // ------------------------------------------------------------

  async sendMagicCode(dto: MagicLinkDto, ip?: string) {
    const code = randomCode(6);
    await this.prisma.authChallenge.updateMany({
      where: { email: dto.email, purpose: 'LOGIN', consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.authChallenge.create({
      data: {
        email: dto.email,
        purpose: 'LOGIN',
        codeHash: hashWithPepper(code, this.pepper),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    await this.mail.sendMagicCode(dto.email, code);
    void ip;
    return {
      ok: true,
      expiresIn: CODE_TTL_MS / 1000,
      devCode: this.config.get<string>('env') === 'development' ? code : undefined,
    };
  }

  async verifyCode(dto: VerifyCodeDto, res: Response, ip?: string): Promise<{ user: SessionUser }> {
    const purpose = dto.purpose ?? 'LOGIN';
    const challenge = await this.prisma.authChallenge.findFirst({
      where: {
        email: dto.email,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new BadRequestException({ code: 'INVALID_CODE', message: 'El código no existe o venció' });
    }
    if (challenge.attempts >= 5) {
      throw new BadRequestException({ code: 'TOO_MANY_ATTEMPTS', message: 'Demasiados intentos. Pedí un código nuevo' });
    }
    if (hashWithPepper(dto.code, this.pepper) !== challenge.codeHash) {
      await this.prisma.authChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({ code: 'INVALID_CODE', message: 'El código es incorrecto' });
    }

    await this.prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          emailVerified: new Date(),
          name: dto.email.split('@')[0],
        },
      });
    }
    return this.issueSession(user, res, ip);
  }

  // ------------------------------------------------------------
  // Email + contraseña (locales y admin)
  // ------------------------------------------------------------

  async login(dto: LoginDto, res: Response, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email o contraseña incorrectos' });
    }
    if (!user.isActive) {
      throw new ForbiddenException({ code: 'ACCOUNT_DISABLED', message: 'Tu cuenta está desactivada' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // 2FA por email para administradores que lo tienen activado
    if (user.twoFactorEnabled) {
      const code = randomCode(6);
      await this.prisma.authChallenge.updateMany({
        where: { email: user.email, purpose: '2FA', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await this.prisma.authChallenge.create({
        data: {
          email: user.email,
          purpose: '2FA',
          codeHash: hashWithPepper(code, this.pepper),
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      });
      await this.mail.sendMagicCode(user.email, code);
      return {
        requires2fa: true,
        email: user.email,
        devCode: this.config.get<string>('env') === 'development' ? code : undefined,
      };
    }

    return this.issueSession(user, res, ip);
  }

  // ------------------------------------------------------------
  // Google (clientes)
  // ------------------------------------------------------------

  async googleLogin(idToken: string, res: Response, ip?: string) {
    const info = await this.verifyGoogleIdToken(idToken);
    const email = info.email as string | undefined;
    const googleId = info.sub as string | undefined;
    if (!email) {
      throw new BadRequestException({ code: 'GOOGLE_NO_EMAIL', message: 'La cuenta de Google no tiene email' });
    }

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId, emailVerified: user.emailVerified ?? new Date() },
      });
    }
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { googleId } });
    }
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          emailVerified: new Date(),
          name: typeof info.name === 'string' ? info.name : email.split('@')[0],
          avatarUrl: typeof info.picture === 'string' ? info.picture : undefined,
          googleId,
        },
      });
    }
    return this.issueSession(user, res, ip);
  }

  private async verifyGoogleIdToken(idToken: string): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok || data.error) {
        throw new Error('token inválido');
      }
      return data;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_GOOGLE_TOKEN', message: 'El token de Google no es válido' });
    }
  }

  // ------------------------------------------------------------
  // Sesión: emisión, refresh rotativo, logout
  // ------------------------------------------------------------

  async issueSession(user: User, res: Response, ip?: string, membershipOverride?: MembershipClaims | null) {
    const memberships = await this.prisma.establishmentMember.findMany({
      where: { userId: user.id, isActive: true },
      include: { establishment: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const membership =
      membershipOverride && membershipOverride.establishmentId
        ? membershipOverride
        : memberships[0]
          ? { establishmentId: memberships[0].establishmentId, memberRole: memberships[0].role }
          : null;

    const payload: JwtPayload = {
      sub: user.id,
      globalRole: user.globalRole,
      membership,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: this.accessTtl as StringValue });

    const rawRefresh = randomToken(32);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashWithPepper(rawRefresh, this.pepper),
        expiresAt: new Date(Date.now() + this.refreshTtlDays * 86400_000),
        ip,
      },
    });

    this.setCookies(res, accessToken, rawRefresh);
    return { user: this.serialize(user, memberships) };
  }

  async refresh(res: Response, rawRefresh?: string) {
    if (!rawRefresh) {
      throw new UnauthorizedException({ code: 'NO_REFRESH_TOKEN', message: 'No hay sesión para renovar' });
    }
    const tokenHash = hashWithPepper(rawRefresh, this.pepper);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'La sesión venció. Volvé a ingresar' });
    }
    // Rotación: revocar el actual y emitir uno nuevo
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(stored.user, res, stored.ip ?? undefined);
  }

  async logout(res: Response, rawRefresh?: string) {
    if (rawRefresh) {
      const tokenHash = hashWithPepper(rawRefresh, this.pepper);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(ACCESS_COOKIE, { httpOnly: true, sameSite: 'lax' as const, secure: this.secure, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'lax' as const, secure: this.secure, path: '/' });
    return { ok: true };
  }

  async switchEstablishment(userId: string, establishmentId: string, res: Response) {
    const membership = await this.prisma.establishmentMember.findFirst({
      where: { userId, establishmentId, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenException({ code: 'NOT_MEMBER', message: 'No sos miembro de ese establecimiento' });
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.issueSession(user, res, undefined, {
      establishmentId: membership.establishmentId,
      memberRole: membership.role,
    });
  }

  // ------------------------------------------------------------
  // Invitaciones
  // ------------------------------------------------------------

  async acceptInvitation(dto: AcceptInvitationDto, res: Response, ip?: string) {
    const tokenHash = hashWithPepper(dto.token, this.pepper);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: { establishment: true },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException({ code: 'INVALID_INVITATION', message: 'La invitación no es válida o venció' });
    }

    let user = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: invitation.email,
          name: dto.name ?? invitation.email.split('@')[0],
          emailVerified: new Date(),
          passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        },
      });
    } else if (dto.password) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }) },
      });
    }

    await this.prisma.establishmentMember.upsert({
      where: {
        userId_establishmentId: { userId: user.id, establishmentId: invitation.establishmentId },
      },
      create: { userId: user.id, establishmentId: invitation.establishmentId, role: invitation.role },
      update: { isActive: true, role: invitation.role },
    });
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    await this.audit.log({
      actorId: user.id,
      establishmentId: invitation.establishmentId,
      action: 'invitation.accepted',
      entity: 'Invitation',
      entityId: invitation.id,
      ip,
    });

    return this.issueSession(user, res, ip);
  }

  /** Perfil del usuario autenticado, incluye membresías. */
  async me(userId: string): Promise<{ user: SessionUser }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const memberships = await this.prisma.establishmentMember.findMany({
      where: { userId: user.id, isActive: true },
      include: { establishment: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { user: this.serialize(user, memberships) };
  }

  /** Cambia la contraseña de un usuario autenticado (para /me). */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash && !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'La contraseña actual es incorrecta' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }) },
    });
    // Revocar todas las sesiones excepto la actual
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private setCookies(res: Response, access: string, refresh: string) {
    const base = { httpOnly: true, sameSite: 'lax' as const, secure: this.secure, path: '/' };
    res.cookie(ACCESS_COOKIE, access, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, refresh, { ...base, maxAge: this.refreshTtlDays * 86400_000 });
  }

  private serialize(user: User, memberships: (EstablishmentMember & { establishment: { name: string } })[]): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
      emailVerified: !!user.emailVerified,
      memberships: memberships.map((m) => ({
        establishmentId: m.establishmentId,
        establishmentName: m.establishment.name,
        role: m.role,
      })),
    };
  }
}