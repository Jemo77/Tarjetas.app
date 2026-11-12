import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GlobalRole, MemberRole } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service.js';
import { CurrentTenant } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { GlobalRoles, Roles } from '../../common/decorators/roles.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PlanDto } from './dto/plan.dto.js';
import type { Request } from 'express';

@ApiTags('admin')
@GlobalRoles(GlobalRole.SUPER_ADMIN)
@Controller('admin/plans')
export class AdminPlansController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list() {
    return this.subscriptions.listPlans();
  }

  @Post()
  create(@Body(new ZodValidationPipe(PlanDto)) dto: PlanDto) {
    return this.subscriptions.createPlan(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(PlanDto)) dto: PlanDto) {
    return this.subscriptions.updatePlan(id, dto);
  }
}

@ApiTags('business')
@UseGuards(TenantGuard)
@Controller('business/subscription')
export class BusinessSubscriptionController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @Roles(MemberRole.OWNER)
  get(@CurrentTenant() tenant: string) {
    return this.subscriptions.businessSubscription(tenant);
  }
}

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Public()
  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  mercadopago(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.subscriptions.handleWebhook(body, req.headers as Record<string, string | string[] | undefined>);
  }
}