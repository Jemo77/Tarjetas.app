import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto.js';
import { hashWithPepper, randomToken } from '../../common/utils/tokens.js';

@Injectable()
export class MembersService {
  private readonly pepper: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {
    this.pepper = process.env.HASH_PEPPER ?? 'dev-pepper';
  }

  async list(establishmentId: string) {
    const members = await this.prisma.establishmentMember.findMany({
      where: { establishmentId },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, lastLoginAt: true } },
        stampPoints: { where: { isActive: true }, select: { id: true, token: true, label: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    const pendingInvitations = await this.prisma.invitation.findMany({
      where: { establishmentId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    return { members, pendingInvitations };
  }

  async add(establishmentId: string, dto: CreateMemberDto, actorId: string, ip?: string, appUrl?: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const existingMembership = existingUser
      ? await this.prisma.establishmentMember.findUnique({
          where: { userId_establishmentId: { userId: existingUser.id, establishmentId } },
        })
      : null;

    if (existingMembership?.isActive) {
      throw new ConflictException({ code: 'ALREADY_MEMBER', message: 'Esa persona ya es parte del equipo' });
    }

    if (existingUser) {
      if (existingMembership && !existingMembership.isActive) {
        await this.prisma.establishmentMember.update({
          where: { id: existingMembership.id },
          data: { isActive: true, role: dto.role },
        });
      } else {
        await this.prisma.establishmentMember.create({
          data: { userId: existingUser.id, establishmentId, role: dto.role },
        });
      }
      await this.audit.log({ actorId, establishmentId, action: 'member.add', entity: 'EstablishmentMember', ip, metadata: { email: dto.email, role: dto.role } });
      return { ok: true, created: false };
    }

    // No existe el usuario: invitación por email
    const rawToken = randomToken(32);
    const invitation = await this.prisma.invitation.create({
      data: {
        email: dto.email,
        establishmentId,
        role: dto.role,
        tokenHash: hashWithPepper(rawToken, this.pepper),
        invitedById: actorId,
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      },
    });
    const url = `${appUrl ?? ''}/accept-invitation?token=${encodeURIComponent(rawToken)}`;
    await this.mail.sendInvitation(dto.email, url, 'tu nuevo equipo', dto.role);
    await this.audit.log({ actorId, establishmentId, action: 'invitation.sent', entity: 'Invitation', entityId: invitation.id, ip });
    return { ok: true, created: true, token: rawToken, invitationUrl: url };
  }

  async update(establishmentId: string, memberId: string, dto: UpdateMemberDto, actorId: string, ip?: string) {
    const member = await this.prisma.establishmentMember.findFirst({
      where: { id: memberId, establishmentId },
    });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'No se encontró al miembro' });

    if (member.role === MemberRole.OWNER && dto.role && dto.role !== MemberRole.OWNER) {
      const owners = await this.prisma.establishmentMember.count({
        where: { establishmentId, role: MemberRole.OWNER, isActive: true },
      });
      if (owners <= 1) {
        throw new BadRequestException({ code: 'LAST_OWNER', message: 'No se puede quitar el último dueño' });
      }
    }

    const updated = await this.prisma.establishmentMember.update({
      where: { id: member.id },
      data: { role: dto.role, isActive: dto.isActive },
    });
    await this.audit.log({
      actorId,
      establishmentId,
      action: 'member.update',
      entity: 'EstablishmentMember',
      entityId: member.id,
      metadata: { ...dto },
      ip,
    });
    return { member: updated };
  }

  async remove(establishmentId: string, memberId: string, actorId: string, ip?: string) {
    const member = await this.prisma.establishmentMember.findFirst({
      where: { id: memberId, establishmentId },
    });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'No se encontró al miembro' });
    if (member.role === MemberRole.OWNER) {
      const owners = await this.prisma.establishmentMember.count({
        where: { establishmentId, role: MemberRole.OWNER, isActive: true },
      });
      if (owners <= 1) {
        throw new BadRequestException({ code: 'LAST_OWNER', message: 'No se puede remover al último dueño' });
      }
    }
    await this.prisma.establishmentMember.update({
      where: { id: member.id },
      data: { isActive: false },
    });
    await this.audit.log({ actorId, establishmentId, action: 'member.remove', entity: 'EstablishmentMember', entityId: member.id, ip });
    return { ok: true };
  }
}