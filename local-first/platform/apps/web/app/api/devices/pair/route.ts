import { NextRequest, NextResponse } from 'next/server';
import { claimPairingCode } from '@/lib/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory rate limiter tracking: IP & code failure attempts within 15 minutes window
interface FailureRecord {
  count: number;
  resetAt: number;
}
const failureMap = new Map<string, FailureRecord>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const rec = failureMap.get(key);
  if (!rec) return true;
  if (now > rec.resetAt) {
    failureMap.delete(key);
    return true;
  }
  return rec.count < MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now = Date.now();
  const rec = failureMap.get(key);
  if (!rec || now > rec.resetAt) {
    failureMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    rec.count++;
  }
}

function clearFailures(key: string) {
  failureMap.delete(key);
}

/**
 * POST /api/devices/pair
 * Unauthenticated LAN endpoint for new client devices to submit pairing codes.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, deviceId, deviceName } = body;

  if (!code || !deviceId) {
    return NextResponse.json({ error: 'missing_fields', message: 'Pairing code and deviceId are required.' }, { status: 400 });
  }

  const cleanCode = String(code).trim();
  const userAgent = req.headers.get('user-agent') || 'Unknown LAN Device';
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

  // Check rate limit on IP and on the specific code
  const ipKey = `ip:${ipAddress}`;
  const codeKey = `code:${cleanCode}`;

  if (!checkRateLimit(ipKey) || !checkRateLimit(codeKey)) {
    return NextResponse.json(
      { error: 'too_many_attempts', message: 'Too many invalid pairing attempts. Please wait 15 minutes or generate a new pairing code.' },
      { status: 429 }
    );
  }

  try {
    const result = await claimPairingCode({
      code: cleanCode,
      deviceId: String(deviceId),
      deviceName: String(deviceName || 'LAN Device'),
      userAgent,
      ipAddress,
    });

    // Clear rate-limiting records on successful claim
    clearFailures(ipKey);
    clearFailures(codeKey);

    return NextResponse.json({
      ok: true,
      deviceToken: result.deviceToken,
      tenantId: result.tenantId,
      outletId: result.outletId,
      role: result.role,
      device: {
        id: result.device.id,
        name: result.device.name,
        role: result.device.role,
      },
    });
  } catch (err: any) {
    if (err?.message === 'INVALID_PAIRING_CODE') {
      recordFailure(ipKey);
      recordFailure(codeKey);
      return NextResponse.json({ error: 'invalid_code', message: 'Pairing code is invalid or has expired.' }, { status: 400 });
    }
    if (err?.message === 'DEVICE_DISABLED') {
      return NextResponse.json({ error: 'device_disabled', message: 'This device has been disabled by the owner.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'pairing_failed', message: err?.message || 'Failed to pair device.' }, { status: 500 });
  }
}
