import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { MembersService } from './members.service.js';
import { CurrentTenant, CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto.js';
import type { Request } from 'express';

@ApiTags('business')
@UseGuards(TenantGuard, SubscriptionActiveGuard)
@Controller('business/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  list(@CurrentTenant() tenant: string) {
    return this.members.list(tenant);
  }

  @Post()
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  add(
    @CurrentTenant() tenant: string,
    @Body(new ZodValidationPipe(CreateMemberDto)) dto: CreateMemberDto,
    @CurrentUserId() actorId: string,
    @Req() req: Request,
  ) {
    return this.members.add(tenant, dto, actorId, this.ip(req), process.env.APP_URL);
  }

  @Patch(':id')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  update(
    @CurrentTenant() tenant: string,
    @Param('id') memberId: string,
    @Body(new ZodValidationPipe(UpdateMemberDto)) dto: UpdateMemberDto,
    @CurrentUserId() actorId: string,
    @Req() req: Request,
  ) {
    return this.members.update(tenant, memberId, dto, actorId, this.ip(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  remove(@CurrentTenant() tenant: string, @Param('id') memberId: string, @CurrentUserId() actorId: string, @Req() req: Request) {
    return this.members.remove(tenant, memberId, actorId, this.ip(req));
  }

  private ip(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    return req.socket?.remoteAddress;
  }
}