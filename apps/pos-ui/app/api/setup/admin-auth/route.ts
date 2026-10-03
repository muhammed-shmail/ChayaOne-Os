/**
 * ChayaOne Setup — Admin Authentication & TOTP API
 *
 * POST /api/setup/admin-auth?action=login        → validate username + password
 * POST /api/setup/admin-auth?action=verify-totp  → validate Google Authenticator code
 * POST /api/setup/admin-auth?action=totp-qr      → get QR code URL for first-time scan
 * POST /api/setup/admin-auth?action=validate-session → check if session is 2FA verified
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Hardcoded admin credentials ───────────────────────────────────────────────
const SETUP_ADMIN_USERNAME = 'administrator@Chayaone';
const SETUP_ADMIN_PASSWORD = '9995366767@Chayaone';

// ── Native TOTP implementation (RFC 6238 / RFC 4226) — no external lib ────────
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const str = input.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of str) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function generateBase32Secret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let result = '';
  let bits = 0, value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_CHARS[(value << (5 - bits)) & 0x1f];
  return result;
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.allocUnsafe(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = (hmac[hmac.length - 1] as number) & 0x0f;
  const code =
    (((hmac[offset] as number) & 0x7f) << 24) |
    (((hmac[offset + 1] as number) & 0xff) << 16) |
    (((hmac[offset + 2] as number) & 0xff) << 8) |
    ((hmac[offset + 3] as number) & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function totpVerify(token: string, secret: string, window = 1): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, counter + i) === token.trim()) return true;
  }
  return false;
}

function totpKeyUri(accountName: string, issuer: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ── TOTP secret storage ───────────────────────────────────────────────────────

const TOTP_SECRET_FILE = path.resolve(process.cwd(), '.chayaone-data', 'config', 'totp-setup.key');

function getOrCreateTotpSecret(): string {
  try {
    const dir = path.dirname(TOTP_SECRET_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(TOTP_SECRET_FILE)) {
      const secret = fs.readFileSync(TOTP_SECRET_FILE, 'utf8').trim();
      if (secret && secret.length >= 16) return secret;
    }

    // Generate a new TOTP secret
    const secret = generateBase32Secret(20);
    fs.writeFileSync(TOTP_SECRET_FILE, secret, 'utf8');
    return secret;
  } catch {
    // Fallback: derive from fixed seed (less secure but functional offline)
    return 'CHAYAONE2026NURO7SETUPTOTP32CHR';
  }
}

// Short-lived setup session tokens (in-memory, TTL 10 minutes)
const setupSessions = new Map<string, { createdAt: number; verified: boolean }>();
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

function cleanSessions() {
  const now = Date.now();
  for (const [k, v] of setupSessions.entries()) {
    if (now - v.createdAt > SESSION_TTL) setupSessions.delete(k);
  }
}

export async function POST(req: NextRequest) {
  cleanSessions();
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';
  const body = await req.json().catch(() => ({}));

  // ── Action: verify admin credentials ────────────────────────────────────────
  if (action === 'login') {
    const { username, password } = body;

    const userOk = username?.trim() === SETUP_ADMIN_USERNAME;
    const passOk = password?.trim() === SETUP_ADMIN_PASSWORD;

    if (!userOk || !passOk) {
      // Generic error to prevent credential enumeration
      return NextResponse.json({ error: 'Invalid administrator credentials.' }, { status: 401 });
    }

    // Issue a short-lived session token for the TOTP step
    const setupToken = crypto.randomBytes(24).toString('hex');
    setupSessions.set(setupToken, { createdAt: Date.now(), verified: false });

    return NextResponse.json({ ok: true, setupToken, totpRequired: true });
  }

  // ── Action: verify TOTP ──────────────────────────────────────────────────────
  if (action === 'verify-totp') {
    const { setupToken, totpCode } = body;

    const session = setupToken ? setupSessions.get(setupToken) : null;
    if (!session) {
      return NextResponse.json({ error: 'Session expired or invalid. Please log in again.' }, { status: 401 });
    }
    if (Date.now() - session.createdAt > SESSION_TTL) {
      setupSessions.delete(setupToken);
      return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 });
    }

    const secret = getOrCreateTotpSecret();
    const isValid = totpVerify(String(totpCode).trim(), secret);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid authenticator code. Please try again.' }, { status: 401 });
    }

    // Mark session as 2FA-verified
    setupSessions.set(setupToken, { ...session, verified: true });
    return NextResponse.json({ ok: true, verified: true });
  }

  // ── Action: get TOTP QR info (for scanning) ──────────────────────────────────
  if (action === 'totp-qr') {
    const secret = getOrCreateTotpSecret();
    const otpAuthUrl = totpKeyUri(SETUP_ADMIN_USERNAME, 'ChayaOne OS', secret);
    return NextResponse.json({ ok: true, otpAuthUrl, secret });
  }

  // ── Action: validate setup session (called before final activation) ──────────
  if (action === 'validate-session') {
    const { setupToken } = body;
    const session = setupToken ? setupSessions.get(setupToken) : null;
    if (!session || !session.verified || Date.now() - session.createdAt > SESSION_TTL) {
      return NextResponse.json({ ok: false, error: 'Session invalid or not 2FA verified.' }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
