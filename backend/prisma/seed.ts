// ============================================================
// Seed: planes por defecto + super admin
// Ejecutar con: node prisma/seed.ts   (Node 26 ejecuta TS nativo)
// ============================================================
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { GlobalRole, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PLANS: Array<{
  code: string;
  name: string;
  priceCents: number;
  interval: 'MONTHLY' | 'YEARLY';
  currency: string;
  maxCustomers: number | null;
  maxStaff: number | null;
  features: Record<string, unknown>;
}> = [
  {
    code: 'free',
    name: 'Gratis',
    priceCents: 0,
    interval: 'MONTHLY',
    currency: 'ARS',
    maxCustomers: 50,
    maxStaff: 5,
    features: { qr: true, nfc: true, geofence: false, analytics: 'basic', branding: false },
  },
  {
    code: 'pro',
    name: 'Pro',
    priceCents: 14900,
    interval: 'MONTHLY',
    currency: 'ARS',
    maxCustomers: 1000,
    maxStaff: 20,
    features: { qr: true, nfc: true, geofence: true, analytics: 'advanced', branding: false },
  },
  {
    code: 'business',
    name: 'Business',
    priceCents: 44900,
    interval: 'MONTHLY',
    currency: 'ARS',
    maxCustomers: null,
    maxStaff: null,
    features: { qr: true, nfc: true, geofence: true, analytics: 'advanced', branding: true, api: true },
  },
];

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? 'admin@tarjetas.app').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin123!';

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        priceCents: plan.priceCents,
        interval: plan.interval,
        currency: plan.currency,
        maxCustomers: plan.maxCustomers,
        maxStaff: plan.maxStaff,
        features: plan.features,
        isActive: true,
      },
      create: { ...plan, isActive: true },
    });
    console.log(`✔ Plan ${plan.code}`);
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { email },
    update: {
      globalRole: GlobalRole.SUPER_ADMIN,
      isActive: true,
      passwordHash,
      emailVerified: new Date(),
    },
    create: {
      email,
      name: 'Super Admin',
      globalRole: GlobalRole.SUPER_ADMIN,
      isActive: true,
      passwordHash,
      emailVerified: new Date(),
    },
  });
  console.log(`✔ Super admin listo: ${email} / ${password} (cambiá la contraseña en producción)`);

  const totalPlans = await prisma.plan.count();
  const totalUsers = await prisma.user.count();
  console.log(`Resumen: ${totalPlans} planes, ${totalUsers} usuarios.`);
}

main()
  .catch((error) => {
    console.error('Error en el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });