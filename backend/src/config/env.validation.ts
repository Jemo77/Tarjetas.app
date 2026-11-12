import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  REDIS_URL: z.string().optional(),
  APP_URL: z.string().url().optional().default('http://localhost:3000'),
  API_URL: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_TTL: z.string().optional().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),
  REFRESH_TTL_DAYS: z.coerce.number().int().min(1).optional().default(30),
  HASH_PEPPER: z.string().min(1).optional().default('dev-pepper'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MAIL_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY: z.string().optional(),
  R2_SECRET: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  MP_ACCESS_TOKEN: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  JOBS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export function validateEnv(config: Record<string, unknown>) {
  const { success, data, error } = envSchema.safeParse(config);
  if (!success) {
    const details = error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Variables de entorno inválidas:\n${details}`);
  }
  return data;
}

export const ENV_PROVIDER = 'ENV_VALIDATED';