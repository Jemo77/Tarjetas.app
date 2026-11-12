import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { CardTemplatesService } from './card-templates.service.js';
import { CurrentTenant } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CardTemplateDto } from './dto/card-template.dto.js';

@ApiTags('business')
@UseGuards(TenantGuard, SubscriptionActiveGuard)
@Controller('business/card-template')
export class CardTemplatesController {
  constructor(private readonly templates: CardTemplatesService) {}

  @Get()
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  get(@CurrentTenant() tenant: string) {
    return this.templates.get(tenant);
  }

  @Put()
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  put(@CurrentTenant() tenant: string, @Body(new ZodValidationPipe(CardTemplateDto)) dto: CardTemplateDto) {
    return this.templates.put(tenant, dto);
  }
}