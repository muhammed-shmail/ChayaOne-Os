import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Standard scrypt password hashing for staff accounts.
 * Zero external dependencies — uses built-in node:crypto.
 *
 * Password hash format: `scrypt$<saltHex>$<keyHex>`
 */
const KEYLEN = 64;

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(pw, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'hex');
  const want = Buffer.from(parts[2]!, 'hex');
  const got = scryptSync(pw, salt, want.length || KEYLEN);
  return want.length === got.length && timingSafeEqual(want, got);
}
