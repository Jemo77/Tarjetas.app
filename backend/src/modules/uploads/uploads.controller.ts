import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { UploadsService } from './uploads.service.js';
import { CurrentTenant } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SignUploadDto, WriteUploadDto } from './dto/upload.dto.js';
import type { Response } from 'express';

@ApiTags('business')
@UseGuards(TenantGuard, SubscriptionActiveGuard)
@Controller('business/uploads')
export class BusinessUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('sign')
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  sign(@CurrentTenant() tenant: string, @Body(new ZodValidationPipe(SignUploadDto)) dto: SignUploadDto) {
    return this.uploads.sign(tenant, dto.filename, dto.contentType, dto.purpose);
  }

  /** Fallback de desarrollo: sube base64 al disco local. */
  @Post('raw')
  @HttpCode(HttpStatus.OK)
  @Roles(MemberRole.OWNER, MemberRole.MANAGER)
  raw(@CurrentTenant() tenant: string, @Body(new ZodValidationPipe(WriteUploadDto)) dto: WriteUploadDto) {
    return this.uploads.saveLocal(tenant, dto);
  }
}

@ApiTags('uploads')
@Controller()
export class UploadsController {
  /** Sirve archivos locales en desarrollo. */
  @Public()
  @Get('uploads/:path')
  async serve(@Param('path') key: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    if (!/^[a-zA-Z0-9/_.-]+$/.test(key)) {
      throw new NotFoundException('Archivo no encontrado');
    }
    const root = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(root, key);
    if (!filePath.startsWith(root + path.sep) || !existsSync(filePath)) {
      throw new NotFoundException('Archivo no encontrado');
    }
    res.setHeader('Content-Type', this.contentTypeOf(filePath));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(createReadStream(filePath));
  }

  private contentTypeOf(file: string): string {
    const ext = path.extname(file).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.svg':
        return 'image/svg+xml';
      case '.webp':
        return 'image/webp';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  }
}