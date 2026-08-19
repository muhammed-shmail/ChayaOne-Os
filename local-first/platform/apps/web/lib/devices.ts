/**
 * Cafe OS — device & printer registry + LAN Device Pairing Engine (Step 8)
 *
 * Devices (receipt/KOT/label printers) are stored in Outlet.settings.devices.
 * Client devices (POS, KDS, Waiter tablets) pair via 6-digit numeric pairing codes
 * and receive cryptographically bound DeviceTokens for LAN security.
 */

import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { prisma, DeviceRole, DeviceStatus } from '@cafeos/db';

export const DEVICE_TYPES = [
  { value: 'receipt_printer', label: 'Receipt / Bill printer', icon: '🧾', station: false },
  { value: 'kot_printer', label: 'Kitchen (KOT) printer', icon: '🍳', station: true },
  { value: 'label_printer', label: 'Label printer', icon: '🏷️', station: false },
  { value: 'cash_drawer', label: 'Cash drawer', icon: '💵', station: false },
  { value: 'display', label: 'KDS Display', icon: '📺', station: true },
  { value: 'other', label: 'Other Device', icon: '⚙️', station: false },
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number]['value'];

export const DEVICE_CONNECTIONS = [
  { value: 'network', label: 'Network (LAN/IP — TCP 9100)' },
  { value: 'usb', label: 'USB Raw Port' },
  { value: 'bluetooth', label: 'Bluetooth Device' },
] as const;

export type DeviceConnection = (typeof DEVICE_CONNECTIONS)[number]['value'];

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  connection: DeviceConnection;
  /** IP:port for network, device path/id for USB/BT — free text, optional */
  target: string;
  ip?: string | null;
  port?: number | string | null;
  /** kitchen | bar | bakery | dessert | custom — only meaningful for KOT printers */
  station: string | null;
  priority?: 'primary' | 'backup';
  kotRule?: 'station_only' | 'all_items' | 'custom';
  /** how many copies to print (printers only) */
  copies: number;
  /** the default device for its type */
  isDefault: boolean;
}

const TYPE_VALUES = DEVICE_TYPES.map((t) => t.value) as readonly string[];
const CONN_VALUES = DEVICE_CONNECTIONS.map((c) => c.value) as readonly string[];

/** Read & normalize the device list from Outlet.settings.devices. Never throws. */
export function readDevices(settings: unknown): Device[] {
  const raw = (settings as { devices?: unknown } | null)?.devices;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d): Device | null => {
      const o = d as Record<string, unknown>;
      if (!o || typeof o.id !== 'string' || typeof o.name !== 'string') return null;
      const type = (TYPE_VALUES.includes(o.type as string) ? o.type : 'receipt_printer') as DeviceType;
      const connection = (CONN_VALUES.includes(o.connection as string) ? o.connection : 'network') as DeviceConnection;
      const copies = Number(o.copies);
      const target = typeof o.target === 'string' ? o.target : '';
      const ip = typeof o.ip === 'string' && o.ip ? o.ip : (target.split(':')[0] || '');
      const port = o.port ? String(o.port) : (target.split(':')[1] || '9100');
      const priority = o.priority === 'backup' ? 'backup' : 'primary';
      const kotRule = o.kotRule === 'all_items' ? 'all_items' : o.kotRule === 'custom' ? 'custom' : 'station_only';
      return {
        id: o.id,
        name: o.name,
        type,
        connection,
        target: target || (ip ? `${ip}:${port}` : ''),
        ip: ip || null,
        port: port || '9100',
        station: typeof o.station === 'string' && o.station ? o.station : null,
        priority,
        kotRule,
        copies: Number.isFinite(copies) && copies >= 1 ? Math.min(5, Math.round(copies)) : 1,
        isDefault: !!o.isDefault,
      };
    })
    .filter((d): d is Device => d !== null);
}

/** Ensure at most one default per device type (last-write-wins for the flagged one). */
export function normalizeDefaults(devices: Device[], preferId?: string): Device[] {
  const seen = new Set<string>();
  if (preferId) {
    const pref = devices.find((d) => d.id === preferId);
    if (pref) {
      for (const d of devices) if (d.type === pref.type) d.isDefault = d.id === preferId;
    }
  }
  return devices.map((d) => {
    if (d.isDefault && !seen.has(d.type)) {
      seen.add(d.type);
      return d;
    }
    return d.isDefault && seen.has(d.type) ? { ...d, isDefault: false } : d;
  });
}

// ===================== STEP 8: LAN DEVICE PAIRING & TOKENS =====================

function jwtSecretKey(): Uint8Array {
  const s = process.env.JWT_SECRET || 'chayaone-local-jwt-secret-key-32-chars-long';
  return new TextEncoder().encode(s);
}

export interface DeviceTokenPayload {
  typ: 'device';
  id: string; // Database Device row UUID
  deviceId: string; // Client stable UUID
  tenantId: string;
  outletId: string;
  role: DeviceRole;
}

/**
 * Generate a short-lived 6-digit numeric pairing code for an outlet (TTL = 10 mins).
 */
export async function generatePairingCode(params: {
  tenantId: string;
  outletId: string;
  targetRole?: DeviceRole;
}) {
  const targetRole = params.targetRole || DeviceRole.POS;
  // Generate random 6-digit code e.g. "839421"
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

  // Delete any existing unused codes for this outlet
  await prisma.devicePairingCode.deleteMany({
    where: { outletId: params.outletId, usedAt: null },
  });

  return await prisma.devicePairingCode.create({
    data: {
      tenantId: params.tenantId,
      outletId: params.outletId,
      code,
      targetRole,
      expiresAt,
    },
  });
}

/**
 * Claim a 6-digit pairing code from a new client device over LAN.
 * Registers the Device row and returns a signed DeviceToken.
 */
export async function claimPairingCode(params: {
  code: string;
  deviceId: string;
  deviceName: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const cleanCode = params.code.trim();

  return await prisma.$transaction(async (tx) => {
    const now = new Date();

    // Atomically claim the pairing code if code matches, usedAt is NULL, and expiresAt > NOW()
    const claimed = await tx.devicePairingCode.updateMany({
      where: {
        code: cleanCode,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        usedAt: now,
      },
    });

    if (claimed.count === 0) {
      throw new Error('INVALID_PAIRING_CODE');
    }

    // Fetch the claimed record
    const pairingCode = await tx.devicePairingCode.findFirst({
      where: { code: cleanCode, usedAt: now },
    });

    if (!pairingCode) {
      throw new Error('INVALID_PAIRING_CODE');
    }

    // Register or update Device row
    let device = await tx.device.findUnique({
      where: { deviceId: params.deviceId },
    });

    if (device) {
      if (device.status === DeviceStatus.DISABLED) {
        throw new Error('DEVICE_DISABLED');
      }
      // Update existing device with new pairing
      device = await tx.device.update({
        where: { id: device.id },
        data: {
          tenantId: pairingCode.tenantId,
          outletId: pairingCode.outletId,
          name: params.deviceName,
          role: pairingCode.targetRole,
          status: DeviceStatus.ONLINE,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          lastSeenAt: new Date(),
        },
      });
    } else {
      // Create new device registration
      device = await tx.device.create({
        data: {
          tenantId: pairingCode.tenantId,
          outletId: pairingCode.outletId,
          deviceId: params.deviceId,
          name: params.deviceName,
          role: pairingCode.targetRole,
          status: DeviceStatus.ONLINE,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    }

    // Mint cryptographic DeviceToken (1 year TTL)
    const deviceToken = await new SignJWT({
      typ: 'device',
      id: device.id,
      deviceId: device.deviceId,
      tenantId: device.tenantId,
      outletId: device.outletId,
      role: device.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('365d')
      .sign(jwtSecretKey());

    // Store deviceToken in database
    await tx.device.update({
      where: { id: device.id },
      data: { deviceToken },
    });

    return {
      device,
      deviceToken,
      tenantId: device.tenantId,
      outletId: device.outletId,
      role: device.role,
    };
  });
}

/**
 * Verify a DeviceToken and return active device record if enabled.
 */
export async function verifyDeviceToken(token: string) {
  try {
    const verified = await jwtVerify(token, jwtSecretKey());
    const payload = verified.payload as unknown as DeviceTokenPayload;

    if (payload.typ !== 'device' || !payload.id) return null;

    const device = await prisma.device.findUnique({
      where: { id: payload.id },
    });

    if (!device || device.status === DeviceStatus.DISABLED) {
      return null;
    }

    // Touch lastSeenAt timestamp
    try {
      await prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date(), status: DeviceStatus.ONLINE },
      });
    } catch {}

    return device;
  } catch {
    return null;
  }
}
