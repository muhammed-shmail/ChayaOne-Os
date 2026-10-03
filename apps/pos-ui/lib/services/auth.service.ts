import crypto from 'crypto';
import { prisma, type StaffRole, type StaffUser } from '@cafeos/db';
import { signSession, signRefresh, verifySession, verifyRefresh, type Session } from '../auth';
import { canAccess, landingFor, canManageStaff, type Surface } from '../rbac';

export class AuthService {
  /**
   * Hashes a 4-digit POS PIN using salt and SHA-256.
   */
  static hashPin(pin: string, salt: string = 'chayaone-pin-salt'): string {
    return crypto.createHash('sha256').update(`${pin}:${salt}`).digest('hex');
  }

  /**
   * Authenticates staff member using PIN.
   */
  static async authenticateByPin(outletId: string, pin: string) {
    const cleanPin = pin.trim();
    const pinHash = this.hashPin(cleanPin);

    // Find staff user by pinHash or legacy raw pin match
    const staff = await prisma.staffUser.findFirst({
      where: {
        outletId,
        active: true,
        OR: [{ pinHash }, { pinHash: cleanPin }],
      },
      include: { tenant: { select: { id: true, subdomain: true, status: true } } },
    });

    if (!staff) {
      return null;
    }

    // Auto-migrate plaintext pin to hashed pin if needed
    if (staff.pinHash === cleanPin) {
      await prisma.staffUser.update({
        where: { id: staff.id },
        data: { pinHash },
      }).catch(() => {});
    }

    return staff;
  }

  /**
   * Verifies an scrypt-hashed password.
   */
  static verifyPasswordHash(password: string, storedHash: string): boolean {
    try {
      const [algo, salt, key] = storedHash.split('$');
      if (algo !== 'scrypt' || !salt || !key) return false;
      const derived = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Creates an scrypt password hash.
   */
  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${key}`;
  }

  /**
   * Mints access token and refresh token bound to a StaffSession database row.
   */
  static async createSessionTokens(staff: StaffUser, userAgent?: string | null) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const sessionRow = await prisma.staffSession.create({
      data: {
        tenantId: staff.tenantId,
        staffId: staff.id,
        userAgent: userAgent ?? undefined,
        expiresAt,
      },
      select: { id: true },
    });

    const accessToken = await signSession({
      staffId: staff.id,
      name: staff.name,
      role: staff.role,
      tenantId: staff.tenantId,
      outletId: staff.outletId ?? '',
      sid: sessionRow.id,
    });

    const refreshToken = await signRefresh(sessionRow.id);

    return { accessToken, refreshToken, sessionId: sessionRow.id };
  }

  /**
   * Verifies access token from request header or cookie.
   */
  static async verifyToken(token: string): Promise<Session | null> {
    return await verifySession(token);
  }

  /**
   * Checks whether role can reach a given operational surface (pos, kds, approvals, dashboard).
   */
  static canAccessSurface(role: string, surface: Surface): boolean {
    return canAccess(role, surface);
  }

  /**
   * Checks if staff user can manage other staff members.
   */
  static canManageStaffUsers(role: string): boolean {
    return canManageStaff(role);
  }

  /**
   * Landing route for a role.
   */
  static getLandingUrl(role: string): string {
    return landingFor(role);
  }
}
