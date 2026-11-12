import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService, REFRESH_COOKIE } from './auth.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  AcceptInvitationDto,
  GoogleLoginDto,
  LoginDto,
  MagicLinkDto,
  SwitchEstablishmentDto,
  VerifyCodeDto,
} from './dto/auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('magic-link')
  @HttpCode(HttpStatus.OK)
  magicLink(@Body(new ZodValidationPipe(MagicLinkDto)) dto: MagicLinkDto, @Req() req: Request) {
    return this.auth.sendMagicCode(dto, this.ip(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  verifyCode(
    @Body(new ZodValidationPipe(VerifyCodeDto)) dto: VerifyCodeDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.auth.verifyCode(dto, res, this.ip(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  google(
    @Body(new ZodValidationPipe(GoogleLoginDto)) dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.auth.googleLogin(dto.idToken, res, this.ip(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(LoginDto)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.auth.login(dto, res, this.ip(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const refresh = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    return this.auth.refresh(res, refresh);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const refresh = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    return this.auth.logout(res, refresh);
  }

  @Public()
  @Post('accept-invitation')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(
    @Body(new ZodValidationPipe(AcceptInvitationDto)) dto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.auth.acceptInvitation(dto, res, this.ip(req));
  }

  @Post('switch-establishment')
  @HttpCode(HttpStatus.OK)
  switchEstablishment(
    @Body(new ZodValidationPipe(SwitchEstablishmentDto)) dto: SwitchEstablishmentDto,
    @CurrentUserId() userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.switchEstablishment(userId, dto.establishmentId, res);
  }

  private ip(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    return req.socket?.remoteAddress;
  }
}