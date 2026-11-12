import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { StampPointsService } from './stamp-points.service.js';
import { CurrentTenant } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UpdateStampPointDto } from './dto/stamp-point.dto.js';
import type { Response } from 'express';

@ApiTags('business')
@UseGuards(TenantGuard, SubscriptionActiveGuard)
@Controller('business/stamp-point')
export class StampPointsController {
  constructor(private readonly points: StampPointsService) {}

  @Get()
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  get(@CurrentTenant() tenant: string) {
    return this.points.getForBusiness(tenant);
  }

  @Patch()
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  update(@CurrentTenant() tenant: string, @Body(new ZodValidationPipe(UpdateStampPointDto)) dto: UpdateStampPointDto) {
    return this.points.update(tenant, dto);
  }

  @Post('rotate')
  @Roles(MemberRole.OWNER)
  rotate(@CurrentTenant() tenant: string) {
    return this.points.rotate(tenant);
  }

  @Get('qr.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Content-Disposition', 'attachment; filename="qr.svg"')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  async qrSvg(@CurrentTenant() tenant: string): Promise<string> {
    return this.points.qrSvg(tenant);
  }

  @Get('qr.png')
  @Header('Content-Type', 'image/png')
  @Header('Content-Disposition', 'attachment; filename="qr.png"')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  async qrPng(@CurrentTenant() tenant: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const buffer = await this.points.qrPng(tenant);
    res.setHeader('Content-Length', buffer.length);
    return new StreamableFile(buffer);
  }
}

@ApiTags('business')
@UseGuards(TenantGuard)
@Controller('business')
export class RotatingTokenController {
  constructor(
    private readonly points: StampPointsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Token vigente del QR dinámico (para STAFF y superiores). */
  @Get('rotating-token')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER, MemberRole.STAFF)
  async rotatingToken(@CurrentTenant() tenant: string) {
    const data = await this.points.getForBusiness(tenant);
    const point = data.point;
    if (point.validationMode !== 'ROTATING' || !point.currentWindow) {
      return { rotating: false, message: 'El punto de sellado no está en modo dinámico' };
    }
    const establishment = await this.prisma.establishment.findUnique({
      where: { id: tenant },
      select: { name: true, logoUrl: true },
    });
    return {
      rotating: true,
      establishment,
      url: point.currentWindow.url,
      token: point.currentWindow.token,
      windowIndex: point.currentWindow.windowIndex,
      validForSeconds: point.currentWindow.validForSeconds,
    };
  }
}

@ApiTags('public')
@Controller('public')
export class PublicStampPointsController {
  constructor(private readonly points: StampPointsService) {}

  @Public()
  @Get('stamp-points/:token')
  info(@Param('token') token: string) {
    return this.points.publicInfo(token);
  }
}