import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/** Valida el body/query con un esquema zod y devuelve el dato tipado. */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T, any, any>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}