import { createHash, createHmac, randomBytes } from 'node:crypto';

/** SHA-256 en hex. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** SHA-256 en hex, con un pepper de aplicación (HASH_PEPPER). */
export function hashWithPepper(value: string, pepper: string): string {
  return sha256Hex(`${pepper}::${value}`);
}

/** HMAC-SHA256 en hex. */
export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * Token aleatorio seguro (por defecto 128 bits). Se usa para:
 * tokens de StampPoint, refresh tokens, tokens de invitación.
 */
export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

/** Token aleatorio de alta entropía en hex (para secrets HMAC). */
export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Código OTP numérico de `length` dígitos (por defecto 6). */
export function randomCode(length = 6): string {
  const max = 10 ** length;
  const min = 10 ** (length - 1);
  const n = randomInt(min, max);
  return n.toString();
}

/**
 * Código corto de canje: 6 caracteres sin ambigüedad
 * (sin 0/O, 1/I/L). Se muestra al completar la tarjeta.
 */
const REDEEM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateRedeemCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += REDEEM_ALPHABET[bytes[i]! % REDEEM_ALPHABET.length];
  }
  return out;
}

function randomInt(min: number, max: number): number {
  const range = max - min;
  const bytes = randomBytes(4);
  const value = bytes.readUInt32BE(0) % range;
  return min + value;
}