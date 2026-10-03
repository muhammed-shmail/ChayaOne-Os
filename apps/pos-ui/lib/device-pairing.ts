import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { prisma, DeviceRole, DeviceStatus } from '@cafeos/db';

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
