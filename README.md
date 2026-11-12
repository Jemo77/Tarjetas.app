# Tarjetas.app — Tarjetas de fidelidad digitales (SaaS)

App multitenant de tarjetas de fidelidad: el cliente gana un sello por día por comercio
(vía QR/NFC), completa su tarjeta y canjea una recompensa. Incluye panel para dueños y
equipo, y consola de super administración con planes, auditoría y tareas.

**Estado:** MVP funcional con autenticación, multitenencia, panel de comercio, consola de administración, pagos y jobs programados.

## Stack

- **Backend**: NestJS + Prisma 7 + PostgreSQL, Zod, JWT short + refresh rotativo
  (cookies httpOnly), argon2id, throttling, auditoría, planes/suscripciones (Mercado
  Pago webhook) y jobs programados.
- **Frontend**: Next.js (App Router) + React 19 + Tailwind 4, PWA, tarjeta SVG,
  escáner QR, React Query, Recharts.
- **Auth**: magic-code por email, login con contraseña, 2FA, e impersonación
  (soporte) con JWT de 1 h.

## Estructura

```
backend/   NestJS API (puerto 3001, prefijo global /v1)
frontend/  Next.js app (puerto 3000)
```

- Apuntes de arquitectura y flujos en `backend/ANATOMIA.md` (si existe) y en los
  comentarios de `src/modules/*`.
- `frontend/src/proxy.ts`: routing por rol (SUPER_ADMIN → /admin, membresía → /panel,
  cliente → /cards) leyendo el `access_token` (jose). La paginación y el refresco de
  sesión viven en `frontend/src/lib/api.ts` y `src/lib/auth-context.tsx`.

## Requisitos

- Node 20+ (probado con Node 26 para correr `.ts` nativo y el seed con type-stripping).
- PostgreSQL local (thx. socket en `/tmp/opencode` en dev).

## Backend

```bash
cd backend
cp .env.example .env    # ajustá credenciales
npx prisma migrate dev
node prisma/seed.ts     # planes free/pro/business + super admin
npm run build
npm start               # levanta en :3001
```

Variables clave (dev):

```
DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/tarjetas?host=/tmp/opencode
SUPER_ADMIN_EMAIL=admin@tarjetas.app
SUPER_ADMIN_PASSWORD=Admin123!
APP_URL=http://localhost:3000
PORT=3001
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / PEPPER / MP_* — secretos de producción
```

> En producción reemplazá todos los secretos dev y las claves de R2/Mercado Pago.

### Jobs

Sin Redis: se disparan desde `POST /admin/jobs/:name/run`. Nombres:
`recompute-segments`, `expire-rewards`, `cleanup-auth`, `winback-emails`,
`subscription-check` (ver `backend/src/modules/jobs/jobs.service.ts`).

## Frontend

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3001/v1
npm install
npm run dev          # puerto 3000
```

## Credenciales de prueba (seed)

| Rol | Email | Contraseña |
| --- | --- | --- |
| Super admin | `admin@tarjetas.app` | `Admin123!` |
| Dueño (acepta invitación) | — | — |

Flujo rápido: entrá como super admin → **Locales** → creá uno → **Invitar propietario**
(copia la URL de invitación) → aceptala en `/accept-invitation` → listo, tenés cuenta
de dueño y acceso a `/panel`.

## Autenticación

- Cookies `access_token` + `refresh_token` (httpOnly, SameSite=Lax). El frontend gira
  el refresh automáticamente ante 401 (`credentials: "include"`).
- El tenant se deriva **solo** del JWT (claims `membership`). La unicidad
  `@@unique([userId, establishmentId, stampDate])` en Prisma garantiza un sello/día.
- QR/NFC: un token compartido `/s/{token}?src=qr|nfc` con QR rotativo (HMAC, ventana de
  ~60 s) y geofence opcional. El canje lo confirma el personal desde `/panel/redeem`.

---

## Autoría

Proyecto personal de **Jorge Martín** ([Jemo77](https://github.com/Jemo77)).
