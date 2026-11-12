import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UsersService } from './users.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ChangePasswordDto, UpdateProfileDto } from './dto/user.dto.js';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get('me')
  me(@CurrentUserId() userId: string) {
    return this.users.me(userId);
  }

  @Patch('me')
  updateProfile(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(UpdateProfileDto)) dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    return this.users.updateProfile(userId, dto, this.ip(req));
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ChangePasswordDto)) dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  deleteAccount(@CurrentUserId() userId: string, @Req() req: Request) {
    return this.users.deleteAccount(userId, this.ip(req));
  }

  // ------------------------------------------------------------
  // Tarjetas del cliente
  // ------------------------------------------------------------

  @Get('me/cards')
  myCards(@CurrentUserId() userId: string) {
    return this.users.myCards(userId);
  }

  @Get('me/cards/:id')
  myCard(@CurrentUserId() userId: string, @Param('id') cardId: string) {
    return this.users.myCard(userId, cardId);
  }

  @Get('me/cards/:id/redeem-qr')
  redeemQr(@CurrentUserId() userId: string, @Param('id') cardId: string) {
    return this.users.redeemQr(userId, cardId);
  }

  private ip(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    return req.socket?.remoteAddress;
  }
}