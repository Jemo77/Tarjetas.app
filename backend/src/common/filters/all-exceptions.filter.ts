import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  details?: unknown;
  path: string;
  timestamp: string;
}

/**
 * Filtro global de excepciones.
 * - Traduce errores de Prisma (P2002 → 409, P2025 → 404, ...) a códigos de negocio.
 * - Normaliza HttpException con un `code` de negocio.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url: string; method: string }>();
    const path = `${req.method} ${req.url}`;

    let body: ErrorBody;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      body = this.mapPrismaError(exception, path);
    } else if (exception instanceof HttpException) {
      body = this.mapHttpException(exception, path);
    } else {
      this.logger.error(path, exception as Error);
      body = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un error inesperado',
        path,
        timestamp: new Date().toISOString(),
      };
    }

    if (body.statusCode >= 500) {
      this.logger.error(`${path} → ${body.code}`);
    }

    res.status(body.statusCode).json(body);
  }

  private mapHttpException(exception: HttpException, path: string): ErrorBody {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const details = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
    const rawCode =
      details && typeof details.code === 'string'
        ? details.code
        : typeof raw === 'object' && raw !== null && 'error' in raw && typeof raw.error === 'string'
          ? raw.error
          : STATUS_CODE_MAP[status];
    const code = rawCode ?? 'ERROR';
    const message =
      details && typeof details.message === 'string'
        ? details.message
        : typeof raw === 'string'
          ? raw
          : exception.message;
    return {
      statusCode: status,
      code,
      message,
      path,
      timestamp: new Date().toISOString(),
    };
  }

  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError, path: string): ErrorBody {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');

    switch (error.code) {
      case 'P2002': {
        // Regla clave: un sello por día por cliente en cada establecimiento
        const isStampDaily = target.includes('userId') && target.includes('establishmentId') && target.includes('stampDate');
        return {
          statusCode: HttpStatus.CONFLICT,
          code: isStampDaily ? 'ALREADY_STAMPED_TODAY' : 'DUPLICATE_RESOURCE',
          message: isStampDaily
            ? 'Ya sumaste tu sello de hoy en este local'
            : 'Ya existe un recurso con esos datos',
          details: { target },
          path,
          timestamp: new Date().toISOString(),
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'El recurso no existe o ya no está disponible',
          path,
          timestamp: new Date().toISOString(),
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'REFERENCE_VIOLATION',
          message: 'El recurso está siendo usado por otro registro',
          path,
          timestamp: new Date().toISOString(),
        };
      default:
        this.logger.error(`${path} Prisma(${error.code})`, error instanceof Error ? error : new Error(String(error)));
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: `DB_${error.code}`,
          message: 'Error de base de datos',
          path,
          timestamp: new Date().toISOString(),
        };
    }
  }
}

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};