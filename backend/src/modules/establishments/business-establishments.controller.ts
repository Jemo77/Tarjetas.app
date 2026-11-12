import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { EstablishmentsService } from './establishments.service.js';
import { CurrentTenant } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UpdateBusinessProfileDto } from './dto/establishment.dto.js';

@ApiTags('business')
@UseGuards(TenantGuard, SubscriptionActiveGuard)
@Controller('business')
export class BusinessEstablishmentsController {
  constructor(private readonly establishments: EstablishmentsService) {}

  @Get('establishment')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  profile(@CurrentTenant() tenant: string) {
    return this.establishments.myProfile(tenant);
  }

  @Patch('establishment')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  updateProfile(
    @CurrentTenant() tenant: string,
    @Body(new ZodValidationPipe(UpdateBusinessProfileDto)) dto: UpdateBusinessProfileDto,
  ) {
    return this.establishments.updateProfile(tenant, dto);
  }
}