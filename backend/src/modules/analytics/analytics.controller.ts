import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GlobalRole, MemberRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service.js';
import { CurrentTenant } from '../../common/decorators/current-user.decorator.js';
import { GlobalRoles, Roles } from '../../common/decorators/roles.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ListCustomersQuery } from './dto/analytics.dto.js';

@ApiTags('business')
@UseGuards(TenantGuard)
@Controller('business')
export class BusinessAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('customers')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  customers(@CurrentTenant() tenant: string, @Query(new ZodValidationPipe(ListCustomersQuery)) query: ListCustomersQuery) {
    return this.analytics.customers(tenant, query);
  }

  @Get('customers/:userId')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  customer(@CurrentTenant() tenant: string, @Param('userId') userId: string) {
    return this.analytics.customerDetail(tenant, userId);
  }

  @Get('analytics/overview')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  overview(@CurrentTenant() tenant: string) {
    return this.analytics.overview(tenant);
  }

  @Get('analytics/retention')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  retention(@CurrentTenant() tenant: string) {
    return this.analytics.retention(tenant);
  }

  @Get('analytics/weekday-heatmap')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  weekdayHeatmap(@CurrentTenant() tenant: string) {
    return this.analytics.weekdayHeatmap(tenant);
  }
}

@ApiTags('admin')
@GlobalRoles(GlobalRole.SUPER_ADMIN)
@Controller('admin')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('analytics')
  platform() {
    return this.analytics.platform();
  }
}