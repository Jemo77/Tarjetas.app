export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  apiUrl: process.env.API_URL ?? 'http://localhost:3001/v1',
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    refreshTtlDays: parseInt(process.env.REFRESH_TTL_DAYS ?? '30', 10),
  },
  hashPepper: process.env.HASH_PEPPER ?? 'dev-pepper',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  mail: {
    apiKey: process.env.MAIL_API_KEY ?? '',
    from: process.env.MAIL_FROM ?? 'Tarjetas <no-reply@localhost>',
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY ?? '',
    secretAccessKey: process.env.R2_SECRET ?? '',
    bucket: process.env.R2_BUCKET ?? '',
    publicUrl: process.env.R2_PUBLIC_URL ?? '',
  },
  mp: {
    accessToken: process.env.MP_ACCESS_TOKEN ?? '',
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? '',
  },
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jobsEnabled: process.env.JOBS_ENABLED === 'true',
});