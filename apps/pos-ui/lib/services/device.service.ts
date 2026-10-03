import { prisma, DeviceStatus, DeviceRole, type Prisma } from '@cafeos/db';

export class DeviceService {
  /**
   * Returns all registered devices for an outlet.
   */
  static async getDevices(outletId: string) {
    return await prisma.device.findMany({
      where: { outletId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        name: true,
        role: true,
        status: true,
        ipAddress: true,
        userAgent: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Updates device properties (name, status, role).
   */
  static async updateDevice(
    id: string,
    outletId: string,
    data: { name?: string; status?: DeviceStatus; role?: DeviceRole },
    actorId?: string | null
  ) {
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device || device.outletId !== outletId) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    const updateData: Prisma.DeviceUpdateInput = {};
    if (data.name && typeof data.name === 'string') updateData.name = data.name.trim();
    if (data.status) {
      updateData.status = data.status;
      if (data.status === DeviceStatus.DISABLED) {
        updateData.deviceToken = null; // Revoke token immediately
      }
    }
    if (data.role) updateData.role = data.role;

    const updated = await prisma.device.update({
      where: { id },
      data: updateData,
    });

    if (actorId) {
      await prisma.auditLog.create({
        data: {
          outletId,
          actorId,
          action: data.status === DeviceStatus.DISABLED ? 'device.disabled' : 'device.updated',
          entity: 'device',
          entityId: id,
          after: { name: updated.name, status: updated.status, role: updated.role } as Prisma.InputJsonValue,
        },
      }).catch(() => {});
    }

    return updated;
  }

  /**
   * Revokes and removes a device registration.
   */
  static async removeDevice(id: string, outletId: string, actorId?: string | null) {
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device || device.outletId !== outletId) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    await prisma.device.delete({ where: { id } });

    if (actorId) {
      await prisma.auditLog.create({
        data: {
          outletId,
          actorId,
          action: 'device.revoked',
          entity: 'device',
          entityId: id,
          after: { name: device.name, deviceId: device.deviceId } as Prisma.InputJsonValue,
        },
      }).catch(() => {});
    }

    return { ok: true, id };
  }

  /**
   * Record a heartbeat from a connected client device.
   */
  static async recordHeartbeat(id: string, ipAddress?: string | null) {
    try {
      await prisma.device.update({
        where: { id },
        data: {
          lastSeenAt: new Date(),
          status: DeviceStatus.ONLINE,
          ...(ipAddress ? { ipAddress } : {}),
        },
      });
    } catch {}
  }
}
