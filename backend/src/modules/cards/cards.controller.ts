import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { CardsService } from './cards.service.js';
import { CurrentTenant, CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RedeemDto, RedeemPreviewDto } from './dto/redeem.dto.js';
import type { Request } from 'express';

@ApiTags('business')
@UseGuards(TenantGuard, SubscriptionActiveGuard)
@Controller('business')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Post('redemptions/preview')
  @HttpCode(HttpStatus.OK)
  @Roles(MemberRole.OWNER, MemberRole.MANAGER, MemberRole.STAFF)
  preview(@CurrentTenant() tenant: string, @Body(new ZodValidationPipe(RedeemPreviewDto)) dto: RedeemPreviewDto) {
    return this.cards.preview(tenant, dto);
  }

  @Post('redemptions')
  @HttpCode(HttpStatus.OK)
  @Roles(MemberRole.OWNER, MemberRole.MANAGER, MemberRole.STAFF)
  redeem(
    @CurrentTenant() tenant: string,
    @Body(new ZodValidationPipe(RedeemDto)) dto: RedeemDto,
    @CurrentUserId() actorId: string,
    @Req() req: Request,
  ) {
    return this.cards.redeem(tenant, dto, actorId, this.ip(req));
  }

  private ip(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    return req.socket?.remoteAddress;
  }
}