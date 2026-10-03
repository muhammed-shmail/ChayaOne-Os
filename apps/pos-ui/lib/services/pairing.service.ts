import { SignJWT, jwtVerify } from 'jose';
import { prisma, DeviceRole, DeviceStatus } from '@cafeos/db';

function jwtSecretKey(): Uint8Array {
  const s = process.env.JWT_SECRET || 'chayaone-local-jwt-secret-key-32-chars-long';
  return new TextEncoder().encode(s);
}

export interface DeviceTokenPayload {
  typ: 'device';
  id: string;
  deviceId: string;
  tenantId: string;
  outletId: string;
  role: DeviceRole;
}

export class PairingService {
  /**
   * Generates a 6-digit numeric pairing code with 10-minute TTL.
   */
  static async generatePairingCode(params: {
    tenantId: string;
    outletId: string;
    targetRole?: DeviceRole;
  }) {
    const targetRole = params.targetRole || DeviceRole.POS;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate existing unused codes for this outlet
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
   * Returns active pairing code for an outlet if one exists and is valid.
   */
  static async getActiveCode(outletId: string) {
    return await prisma.devicePairingCode.findFirst({
      where: {
        outletId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Atomically claims a pairing code from a client device.
   */
  static async claimPairingCode(params: {
    code: string;
    deviceId: string;
    deviceName: string;
    userAgent?: string;
    ipAddress?: string;
  }) {
    const cleanCode = params.code.trim();

    return await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Atomic claim: usedAt null and not expired
      const claimed = await tx.devicePairingCode.updateMany({
        where: {
          code: cleanCode,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count === 0) {
        throw new Error('INVALID_PAIRING_CODE');
      }

      const pairingCode = await tx.devicePairingCode.findFirst({
        where: { code: cleanCode, usedAt: now },
      });
      if (!pairingCode) {
        throw new Error('INVALID_PAIRING_CODE');
      }

      // Upsert device record
      let device = await tx.device.findUnique({
        where: { deviceId: params.deviceId },
      });

      if (device) {
        if (device.status === DeviceStatus.DISABLED) {
          throw new Error('DEVICE_DISABLED');
        }
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

      // Mint 1-year cryptographic DeviceToken
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
   * Cryptographically verifies a DeviceToken and checks database status.
   */
  static async verifyDeviceToken(token: string) {
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

      await prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date(), status: DeviceStatus.ONLINE },
      }).catch(() => {});

      return device;
    } catch {
      return null;
    }
  }
}
