/**
 * ChayaOne Setup — Admin Authentication & TOTP API
 *
 * POST /api/setup/admin-auth
 *   body: { username, password }
 *   → Returns { ok, totpRequired, setupToken } or { error }
 *
 * POST /api/setup/verify-totp
 *   body: { setupToken, totpCode }
 *   → Returns { ok, verified } or { error }
 *
 * GET /api/setup/totp-qr
 *   → Returns { qrCodeUrl, secret } for first-time QR scan
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Hardcoded admin credentials ───────────────────────────────────────────────
const SETUP_ADMIN_USERNAME = 'administrator@Chayaone';
const SETUP_ADMIN_PASSWORD = '9995366767@Chayaone';

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
    const secret = authenticator.generateSecret(32);
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
    const isValid = authenticator.verify({ token: String(totpCode).trim(), secret });

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
    const otpAuthUrl = authenticator.keyuri(SETUP_ADMIN_USERNAME, 'ChayaOne OS', secret);
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
