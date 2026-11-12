import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';
import { Request, Response } from 'express';
import { EstablishmentsService } from './establishments.service.js';
import { GlobalRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CreateEstablishmentDto,
  InviteOwnerDto,
  ListEstablishmentsQuery,
  UpdateEstablishmentAdminDto,
} from './dto/establishment.dto.js';

@ApiTags('admin')
@GlobalRoles(GlobalRole.SUPER_ADMIN)
@Controller('admin')
export class AdminEstablishmentsController {
  constructor(private readonly establishments: EstablishmentsService) {}

  @Get('establishments')
  list(@Query(new ZodValidationPipe(ListEstablishmentsQuery)) query: ListEstablishmentsQuery) {
    return this.establishments.list(query);
  }

  @Post('establishments')
  create(
    @Body(new ZodValidationPipe(CreateEstablishmentDto)) dto: CreateEstablishmentDto,
    @CurrentUserId() actorId: string,
    @Req() req: Request,
  ) {
    return this.establishments.create(dto, actorId, this.ip(req));
  }

  @Get('establishments/:id')
  async detail(@Param('id') id: string) {
    const establishment = await this.establishments['prisma'].establishment.findUniqueOrThrow({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        templates: { where: { isActive: true } },
        stampPoints: { where: { isActive: true } },
        _count: { select: { members: true, cards: true, stamps: true } },
      },
    });
    return { establishment };
  }

  @Patch('establishments/:id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateEstablishmentAdminDto)) dto: UpdateEstablishmentAdminDto,
    @CurrentUserId() actorId: string,
    @Req() req: Request,
  ) {
    return this.establishments.update(id, dto, actorId, this.ip(req));
  }

  @Post('establishments/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(@Param('id') id: string, @CurrentUserId() actorId: string, @Req() req: Request) {
    return this.establishments.setStatus(id, 'SUSPENDED', actorId, this.ip(req));
  }

  @Post('establishments/:id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Param('id') id: string, @CurrentUserId() actorId: string, @Req() req: Request) {
    return this.establishments.setStatus(id, 'ACTIVE', actorId, this.ip(req));
  }

  @Post('establishments/:id/invite-owner')
  @HttpCode(HttpStatus.OK)
  inviteOwner(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InviteOwnerDto)) dto: InviteOwnerDto,
    @CurrentUserId() actorId: string,
    @Req() req: Request,
  ) {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    return this.establishments.inviteOwner(id, dto, actorId, this.ip(req), appUrl);
  }

  /** Impersonación de soporte: emite un JWT de 1 h con rol OWNER y lo setea como cookie. */
  @Post('impersonate/:establishmentId')
  @HttpCode(HttpStatus.OK)
  impersonate(
    @Param('establishmentId') establishmentId: string,
    @CurrentUserId() actorId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.establishments.impersonate(establishmentId, actorId, this.ip(req)).then((result) => {
      const secure = process.env.NODE_ENV === 'production';
      res.cookie('access_token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 3600_000,
      });
      return result;
    });
  }

  private ip(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    return req.socket?.remoteAddress;
  }
}