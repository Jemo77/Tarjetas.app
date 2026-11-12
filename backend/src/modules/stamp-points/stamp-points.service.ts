import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValidationMode } from '@prisma/client';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service.js';
import { hmacSha256Hex, randomHex, randomToken } from '../../common/utils/tokens.js';
import { UpdateStampPointDto } from './dto/stamp-point.dto.js';

export const ROTATING_WINDOW_SECONDS = 60;

export interface ResolvedPoint {
  point: {
    id: string;
    establishmentId: string;
    memberId: string | null;
    label: string;
    token: string;
    validationMode: ValidationMode;
    isActive: boolean;
    secret: string | null;
  };
  /** true si el token vino con firma rotativa válida */
  rotatingValid: boolean;
}

@Injectable()
export class StampPointsService {
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000';
  }

  // ------------------------------------------------------------
  // Resolución de tokens (estáticos y rotativos)
  // ------------------------------------------------------------

  /**
   * Resuelve un token de QR/NFC. Los tokens rotativos tienen la forma:
   *   {baseToken}.{windowIndex}.{hmac}
   * Acepta la ventana actual y la anterior.
   */
  async resolveToken(token: string, ip?: string): Promise<ResolvedPoint> {
    const [baseToken, windowRaw, sig] = token.split('.');
    const point = await this.prisma.stampPoint.findUnique({
      where: { token: baseToken ?? token },
    });
    if (!point || !point.isActive) {
      throw new NotFoundException({ code: 'INVALID_STAMP_TOKEN', message: 'El QR/NFC no es válido' });
    }

    if (point.validationMode === 'ROTATING') {
      if (!windowRaw || !sig || !point.secret) {
        throw new NotFoundException({ code: 'INVALID_STAMP_TOKEN', message: 'El QR dinámico venció, pedí uno nuevo' });
      }
      const valid = this.verifyRotatingSignature(point.id, point.secret, baseToken!, windowRaw, sig);
      if (!valid) {
        throw new NotFoundException({ code: 'INVALID_STAMP_TOKEN', message: 'El QR dinámico venció, pedí uno nuevo' });
      }
      void ip;
      return { point, rotatingValid: true };
    }

    return { point, rotatingValid: false };
  }

  verifyRotatingSignature(pointId: string, secret: string, baseToken: string, windowRaw: string, sig: string): boolean {
    const windowIndex = Number(windowRaw);
    if (!Number.isInteger(windowIndex) || windowIndex < 0) return false;
    const current = this.currentWindowIndex();
    const accepted = new Set([current, current - 1]);
    if (!accepted.has(windowIndex)) return false;
    const expected = hmacSha256Hex(secret, `${baseToken}:${windowIndex}`);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return a.equals(b);
  }

  currentWindowIndex(): number {
    return Math.floor(Date.now() / 1000 / ROTATING_WINDOW_SECONDS);
  }

  /** Token vigente del modo ROTATING (para mostrar el QR en pantalla del staff). */
  rotatingToken(point: { id: string; token: string; secret: string | null }): { token: string; url: string; windowIndex: number; validForSeconds: number } {
    if (!point.secret) throw new ForbiddenException({ code: 'ROTATING_NOT_CONFIGURED', message: 'El punto no tiene secreto rotativo' });
    const windowIndex = this.currentWindowIndex();
    const sig = hmacSha256Hex(point.secret, `${point.token}:${windowIndex}`);
    const token = `${point.token}.${windowIndex}.${sig}`;
    return {
      token,
      url: `${this.appUrl}/s/${token}?src=qr`,
      windowIndex,
      validForSeconds: ROTATING_WINDOW_SECONDS,
    };
  }

  pointUrl(token: string, src: 'qr' | 'nfc' = 'qr'): string {
    return `${this.appUrl}/s/${token}?src=${src}`;
  }

  // ------------------------------------------------------------
  // Gestión del punto del local
  // ------------------------------------------------------------

  async getForBusiness(establishmentId: string) {
    const point = await this.prisma.stampPoint.findFirst({
      where: { establishmentId, isActive: true, memberId: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!point) {
      throw new NotFoundException({ code: 'STAMP_POINT_NOT_FOUND', message: 'No hay un punto de sellado activo' });
    }
    return {
      point: {
        id: point.id,
        label: point.label,
        token: point.token,
        validationMode: point.validationMode,
        rotatedAt: point.rotatedAt,
        url: this.pointUrl(point.token),
        nfcUrl: this.pointUrl(point.token, 'nfc'),
        currentWindow:
          point.validationMode === 'ROTATING' ? this.rotatingToken(point) : undefined,
      },
    };
  }

  async update(establishmentId: string, dto: UpdateStampPointDto) {
    const point = await this.prisma.stampPoint.findFirst({
      where: { establishmentId, isActive: true, memberId: null },
    });
    if (!point) throw new NotFoundException({ code: 'STAMP_POINT_NOT_FOUND', message: 'No hay punto de sellado' });

    const data: Record<string, unknown> = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.validationMode !== undefined) {
      data.validationMode = dto.validationMode;
      if (dto.validationMode === 'ROTATING' && !point.secret) {
        data.secret = randomHex(32);
      }
    }
    const updated = await this.prisma.stampPoint.update({ where: { id: point.id }, data });
    return {
      point: {
        id: updated.id,
        label: updated.label,
        validationMode: updated.validationMode,
        url: this.pointUrl(updated.token),
        currentWindow: updated.validationMode === 'ROTATING' ? this.rotatingToken(updated) : undefined,
      },
    };
  }

  /**
   * Rota el token actual: lo desactiva y crea uno nuevo.
   * Los sellos ya emitidos conservan su referencia al punto viejo.
   */
  async rotate(establishmentId: string) {
    const current = await this.prisma.stampPoint.findFirst({
      where: { establishmentId, isActive: true, memberId: null },
    });
    if (current) {
      await this.prisma.stampPoint.update({
        where: { id: current.id },
        data: { isActive: false, rotatedAt: new Date() },
      });
    }
    const point = await this.prisma.stampPoint.create({
      data: {
        establishmentId,
        token: randomToken(16),
        label: current?.label ?? 'Principal',
        validationMode: ValidationMode.STATIC,
        secret: randomHex(32),
      },
    });
    return {
      point: {
        id: point.id,
        label: point.label,
        token: point.token,
        validationMode: point.validationMode,
        url: this.pointUrl(point.token),
        nfcUrl: this.pointUrl(point.token, 'nfc'),
      },
    };
  }

  /** QR en SVG listo para imprimir. */
  async qrSvg(establishmentId: string, src: 'qr' | 'nfc' = 'qr'): Promise<string> {
    const point = await this.prisma.stampPoint.findFirst({
      where: { establishmentId, isActive: true, memberId: null },
    });
    if (!point) throw new NotFoundException({ code: 'STAMP_POINT_NOT_FOUND', message: 'No hay punto de sellado' });
    const url = this.pointUrl(point.token, src);
    return QRCode.toString(url, { type: 'svg', margin: 2, width: 512, errorCorrectionLevel: 'M' });
  }

  /** QR en PNG listo para imprimir. */
  async qrPng(establishmentId: string, src: 'qr' | 'nfc' = 'qr'): Promise<Buffer> {
    const point = await this.prisma.stampPoint.findFirst({
      where: { establishmentId, isActive: true, memberId: null },
    });
    if (!point) throw new NotFoundException({ code: 'STAMP_POINT_NOT_FOUND', message: 'No hay punto de sellado' });
    const url = this.pointUrl(point.token, src);
    return QRCode.toBuffer(url, { type: 'png', margin: 2, width: 512, errorCorrectionLevel: 'M' });
  }

  /** Crea un punto personal para un mozo (QR con atribución). */
  async createPersonalPoint(establishmentId: string, memberId: string, label: string) {
    const member = await this.prisma.establishmentMember.findFirst({
      where: { id: memberId, establishmentId },
    });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'No se encontró al mozo' });
    const point = await this.prisma.stampPoint.create({
      data: {
        establishmentId,
        memberId: member.id,
        token: randomToken(16),
        label,
        validationMode: ValidationMode.STATIC,
        secret: randomHex(32),
      },
    });
    return { point: { id: point.id, label: point.label, token: point.token, url: this.pointUrl(point.token) } };
  }

  // ------------------------------------------------------------
  // Público: información para la página /s/[token]
  // ------------------------------------------------------------

  async publicInfo(token: string) {
    const { point } = await this.resolveToken(token);
    const establishment = await this.prisma.establishment.findUnique({
      where: { id: point.establishmentId },
    });
    if (!establishment || establishment.deletedAt) {
      throw new NotFoundException({ code: 'ESTABLISHMENT_NOT_FOUND', message: 'Local no encontrado' });
    }
    const template = await this.prisma.cardTemplate.findFirst({
      where: { establishmentId: establishment.id, isActive: true },
      orderBy: { version: 'desc' },
    });
    const subscription = await this.prisma.subscription.findUnique({
      where: { establishmentId: establishment.id },
      select: { status: true },
    });
    const active = establishment.status === 'ACTIVE' && (subscription?.status === 'TRIALING' || subscription?.status === 'ACTIVE');
    return {
      establishment: {
        id: establishment.id,
        name: establishment.name,
        category: establishment.category,
        logoUrl: establishment.logoUrl,
        address: establishment.address,
        city: establishment.city,
        timezone: establishment.timezone,
        status: establishment.status,
        active,
        subscriptionStatus: subscription?.status ?? null,
      },
      template: template
        ? {
            stampsRequired: template.stampsRequired,
            rewardTitle: template.rewardTitle,
            rewardDescription: template.rewardDescription,
            backgroundColor: template.backgroundColor,
            backgroundImageUrl: template.backgroundImageUrl,
            textColor: template.textColor,
            accentColor: template.accentColor,
            stampIconKey: template.stampIconKey,
            stampIconUrl: template.stampIconUrl,
            emptySlotStyle: template.emptySlotStyle,
          }
        : null,
      point: { mode: point.validationMode, label: point.label },
    };
  }
}