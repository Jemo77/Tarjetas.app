import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { StampsService } from './stamps.service.js';
import { CurrentTenant, CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ClaimStampDto, ListStampsQuery, ManualStampDto, VoidStampDto } from './dto/stamp.dto.js';
import type { Request } from 'express';

@ApiTags('stamps')
@Controller()
export class StampsController {
  constructor(private readonly stamps: StampsService) {}

  /** El cliente escanea el QR/NFC y suma su sello del día. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('stamps/claim')
  @HttpCode(HttpStatus.OK)
  claim(
    @Body(new ZodValidationPipe(ClaimStampDto)) dto: ClaimStampDto,
    @CurrentUserId() userId: string,
    @Req() req: Request,
  ) {
    return this.stamps.claim(dto, userId, this.ip(req));
  }

  private ip(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    return req.socket?.remoteAddress;
  }
}

@ApiTags('business')
@UseGuards(TenantGuard, SubscriptionActiveGuard)
@Controller('business')
export class BusinessStampsController {
  constructor(private readonly stamps: StampsService) {}

  @Get('stamps')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  list(@CurrentTenant() tenant: string, @Query(new ZodValidationPipe(ListStampsQuery)) query: ListStampsQuery) {
    return this.stamps.list(tenant, query);
  }

  /** Carga manual de un sello para un cliente. */
  @Post('stamps/manual')
  @HttpCode(HttpStatus.OK)
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  manual(
    @CurrentTenant() tenant: string,
    @Body(new ZodValidationPipe(ManualStampDto)) dto: ManualStampDto,
    @CurrentUserId() actorId: string,
    @Req() req: Request,
  ) {
    return this.stamps.manual(tenant, dto, actorId, this.ip(req));
  }

  /** Anula un sello cargado por error. */
  @Post('stamps/:id/void')
  @HttpCode(HttpStatus.OK)
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  void(
    @CurrentTenant() tenant: string,
    @Param('id') stampId: string,
    @Body(new ZodValidationPipe(VoidStampDto)) dto: VoidStampDto,
    @CurrentUserId() actorId: string,
    @Req() req: Request,
  ) {
    return this.stamps.void(tenant, stampId, dto.reason, actorId, this.ip(req));
  }

  private ip(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    return req.socket?.remoteAddress;
  }
}