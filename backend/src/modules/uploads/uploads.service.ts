import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { presignPutUrl } from '../../common/utils/s3-sign.js';

export type UploadPurpose = 'logo' | 'background' | 'stampIcon';

export const PURPOSE_CONTENT_TYPES: Record<UploadPurpose, string[]> = {
  logo: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  background: ['image/jpeg', 'image/png', 'image/webp'],
  stampIcon: ['image/png', 'image/webp', 'image/svg+xml'],
};

const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly config: ConfigService) {}

  getR2() {
    const r2 = this.config.get<{
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
      publicUrl: string;
    }>('r2');
    const configured = r2?.accountId && r2?.accessKeyId && r2?.secretAccessKey && r2?.bucket;
    return configured ? r2! : null;
  }

  /**
   * Firma una subida. En producción devuelve una URL firmada de R2/S3 (PUT).
   * En desarrollo devuelve el endpoint local del backend (POST JSON base64).
   */
  sign(establishmentId: string, filename: string, contentType: string, purpose: UploadPurpose) {
    const allowed = PURPOSE_CONTENT_TYPES[purpose];
    if (!allowed) throw new BadRequestException({ code: 'INVALID_PURPOSE', message: 'Propósito de subida inválido' });
    if (!allowed.includes(contentType)) {
      throw new BadRequestException({
        code: 'INVALID_CONTENT_TYPE',
        message: `Tipo de archivo no permitido para ${purpose} (${allowed.join(', ')})`,
      });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const key = `${establishmentId}/${purpose}/${Date.now()}-${randomBytes(4).toString('hex')}-${safeName}`;

    const r2 = this.getR2();
    if (r2) {
      return {
        dev: false,
        method: 'PUT' as const,
        uploadUrl: presignPutUrl(r2, key, contentType, 600),
        publicUrl: `${r2.publicUrl.replace(/\/$/, '')}/${key}`,
        contentType,
        expiresIn: 600,
        key,
      };
    }

    const apiUrl = this.config.get<string>('apiUrl') ?? 'http://localhost:3001/v1';
    return {
      dev: true,
      method: 'POST' as const,
      uploadUrl: `${apiUrl}/business/uploads/raw`,
      publicUrl: `${apiUrl}/uploads/${key}`,
      contentType,
      key,
    };
  }

  /** Subida local para desarrollo: guarda base64 en disco. */
  async saveLocal(establishmentId: string, body: { key: string; contentType: string; dataBase64: string }) {
    if (!body.key?.startsWith(`${establishmentId}/`)) {
      throw new BadRequestException({ code: 'INVALID_KEY', message: 'La key no corresponde al establecimiento' });
    }
    if (!/^[a-zA-Z0-9/_.-]+$/.test(body.key)) {
      throw new BadRequestException({ code: 'INVALID_KEY', message: 'Filename inválido' });
    }
    const buffer = Buffer.from(body.dataBase64, 'base64');
    if (buffer.length > MAX_BYTES) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'El archivo supera los 5 MB' });
    }
    const allowedTypes = Object.values(PURPOSE_CONTENT_TYPES).flat();
    if (!allowedTypes.includes(body.contentType)) {
      throw new BadRequestException({ code: 'INVALID_CONTENT_TYPE', message: 'Tipo de archivo no permitido' });
    }
    const { mkdir, writeFile } = await import('node:fs/promises');
    const root = process.cwd();
    const dir = `${root}/uploads`;
    const filePath = `${dir}/${body.key}`;
    await mkdir(`${dir}/${establishmentId}`, { recursive: true });
    await writeFile(filePath, buffer);
    this.logger.log(`Subida local: ${body.key} (${buffer.length} bytes)`);
    return { ok: true, file: body.key, bytes: buffer.length };
  }
}