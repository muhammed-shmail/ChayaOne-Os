import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALL_ROLES = ['owner', 'manager', 'cashier', 'waiter', 'kitchen', 'accountant'];
const isRole = (r: unknown) => typeof r === 'string' && ALL_ROLES.includes(r);
const hashPin = (pin: string) => createHash('sha256').update(pin).digest('hex');
const USERNAME_RE = /^[a-z0-9][a-z0-9._@+-]{0,59}$/i;

function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`;
}

function verifyPassword(pw: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'hex');
  const want = Buffer.from(parts[2]!, 'hex');
  const got = scryptSync(pw, salt, want.length || 64);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [rows, customRoles, outlet] = await Promise.all([
    prisma.staffUser.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        email: true,
        active: true,
        employeeCode: true,
        payType: true,
        payRatePaise: true,
        pinHash: true,
        username: true,
        passwordHash: true,
        permissions: true,
        createdAt: true,
      },
    }),
    prisma.role.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { name: 'asc' },
    }).catch(() => []),
    session.outletId
      ? prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } }).catch(() => null)
      : null,
  ]);

  const members = rows.map(({ pinHash, passwordHash, ...m }) => ({
    ...m,
    hasPin: !!pinHash,
    hasLogin: !!passwordHash,
  }));

  const assignable = session.role === 'owner'
    ? ALL_ROLES
    : session.role === 'manager'
    ? ['cashier', 'waiter', 'kitchen', 'accountant']
    : [];

  const waiterStations = ((outlet?.settings as any)?.waiterStations as any[]) || [
    { id: 'p1', code: 'P1', name: 'Main Floor', label: 'P1 Main Floor' },
    { id: 'p2', code: 'P2', name: 'Upper Deck', label: 'P2 Upper Deck' },
  ];

  return NextResponse.json({ members, assignable, customRoles, waiterStations });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // Custom role management
  if (action === 'create_custom_role') {
    const { name, baseRole, permissions } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'name_required' }, { status: 400 });
    const trimmed = String(name).trim();
    const validBase = isRole(baseRole) ? baseRole : 'waiter';
    try {
      const created = await prisma.role.create({
        data: {
          tenantId: session.tenantId,
          name: trimmed,
          permissions: {
            baseRole: validBase,
            ...(typeof permissions === 'object' && permissions !== null ? permissions : {}),
          },
        },
      });
      return NextResponse.json({ ok: true, role: created });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'failed_to_create_role' }, { status: 500 });
    }
  }

  if (action === 'delete_custom_role') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    await prisma.role.deleteMany({ where: { id, tenantId: session.tenantId } }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // Create staff user
  if (action === 'create') {
    const { name, role, phone, employeeCode, pin } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'missing_fields', message: 'Full Name is required' }, { status: 400 });

    const rawRole = role || 'waiter';
    const resolvedRole = isRole(rawRole) ? rawRole : 'waiter';

    let pinHash: string | null = null;
    if (pin && /^\d{4,6}$/.test(String(pin))) {
      pinHash = hashPin(String(pin));
      const clash = await prisma.staffUser.findFirst({ where: { pinHash, active: true }, select: { id: true } });
      if (clash) return NextResponse.json({ error: 'pin_in_use', message: 'PIN is already in use by another staff member' }, { status: 409 });
    }

    let username: string | null = null;
    let passwordHash: string | null = null;
    if (body.username || body.password) {
      const u = String(body.username ?? '').trim().toLowerCase();
      const pw = String(body.password ?? '');
      if (u) {
        if (!USERNAME_RE.test(u)) return NextResponse.json({ error: 'invalid_username', message: 'Username must be 2–60 characters (letters, numbers, ., _, @, -)' }, { status: 400 });
        const uClash = await prisma.staffUser.findFirst({ where: { tenantId: session.tenantId, username: u }, select: { id: true } });
        if (uClash) return NextResponse.json({ error: 'username_in_use', message: `Username "${u}" is already in use` }, { status: 409 });
        username = u;
      }
      if (pw) {
        if (pw.length < 6) return NextResponse.json({ error: 'password_too_short', message: 'Password must be at least 6 characters' }, { status: 400 });
        passwordHash = hashPassword(pw);
      }
    }

    let targetOutletId = session.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({ where: { tenantId: session.tenantId }, select: { id: true } });
      targetOutletId = defaultOutlet?.id || null;
    }

    const payType = body.payType === 'monthly' || body.payType === 'hourly' ? body.payType : null;
    const payRatePaise = body.payRatePaise != null ? Math.round(Number(body.payRatePaise)) : null;

    const permissionsData = body.permissions
      ? { ...body.permissions }
      : { assignedRoles: [rawRole], branchAccess: ['main-branch'], overrides: {}, dataRestrictions: [] };

    try {
      const created = await prisma.staffUser.create({
        data: {
          tenantId: session.tenantId,
          outletId: targetOutletId,
          name: String(name).trim(),
          phone: phone ? String(phone).trim() : null,
          employeeCode: employeeCode ? String(employeeCode).trim() : null,
          role: resolvedRole,
          pinHash,
          username,
          passwordHash,
          payType,
          payRatePaise,
          active: true,
          permissions: permissionsData as any,
        },
        select: {
          id: true,
          name: true,
          role: true,
          phone: true,
          active: true,
          employeeCode: true,
          payType: true,
          payRatePaise: true,
          permissions: true,
        },
      });

      return NextResponse.json({ ok: true, member: { ...created, hasPin: !!pinHash, hasLogin: !!passwordHash } });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'failed_to_create_staff' }, { status: 500 });
    }
  }

  // Update existing staff
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const target = await prisma.staffUser.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (action === 'update') {
    const data: any = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.email !== undefined) data.email = body.email ? String(body.email).trim().toLowerCase() : null;
    if (body.employeeCode !== undefined) data.employeeCode = body.employeeCode ? String(body.employeeCode).trim() : null;
    if (body.role !== undefined && isRole(body.role)) data.role = body.role;
    if (body.active !== undefined) {
      if (id === session.staffId && body.active === false) return NextResponse.json({ error: 'cannot_deactivate_self' }, { status: 400 });
      data.active = !!body.active;
    }
    if (body.username !== undefined && String(body.username).trim()) {
      const u = String(body.username).trim().toLowerCase();
      if (!USERNAME_RE.test(u)) return NextResponse.json({ error: 'invalid_username', message: 'Username must be 2–60 characters' }, { status: 400 });
      const clash = await prisma.staffUser.findFirst({ where: { tenantId: session.tenantId, username: u, NOT: { id } }, select: { id: true } });
      if (clash) return NextResponse.json({ error: 'username_in_use', message: `Username "${u}" is already in use` }, { status: 409 });
      data.username = u;
    }
    if (body.designation !== undefined || body.joiningDate !== undefined || body.branchAccess !== undefined) {
      const prevPerms = (typeof (body.permissions || target.permissions) === 'object' && (body.permissions || target.permissions)
        ? (body.permissions || target.permissions)
        : {}) as Record<string, any>;
      data.permissions = {
        ...prevPerms,
        ...(body.designation !== undefined ? { designation: body.designation ? String(body.designation).trim() : null } : {}),
        ...(body.joiningDate !== undefined ? { joiningDate: body.joiningDate ? String(body.joiningDate).trim() : null } : {}),
        ...(body.branchAccess !== undefined ? { branchAccess: Array.isArray(body.branchAccess) ? body.branchAccess : [body.branchAccess] } : {}),
      };
    } else if (body.permissions !== undefined) {
      data.permissions = body.permissions;
    }

    const updated = await prisma.staffUser.update({
      where: { id },
      data,
      select: { id: true, name: true, role: true, phone: true, email: true, active: true, employeeCode: true, payType: true, payRatePaise: true, username: true, permissions: true, createdAt: true },
    });
    await prisma.auditLog.create({
      data: { outletId: session.outletId, actorId: session.staffId, action: 'staff.updated', entity: 'staff_user', entityId: id, after: { name: updated.name, role: updated.role, active: updated.active } }
    }).catch(() => {});
    return NextResponse.json({ ok: true, member: { ...updated, hasPin: !!target.pinHash, hasLogin: !!target.passwordHash } });
  }

  if (action === 'setlogin') {
    const u = String(body.username ?? '').trim().toLowerCase();
    const pw = String(body.password ?? '');
    if (!u) {
      await prisma.staffUser.update({ where: { id }, data: { username: null, passwordHash: null } });
      return NextResponse.json({ ok: true });
    }
    if (!USERNAME_RE.test(u)) return NextResponse.json({ error: 'invalid_username', message: 'Username must be 2–60 characters (letters, numbers, ., _, @, -)' }, { status: 400 });
    const uClash = await prisma.staffUser.findFirst({ where: { tenantId: session.tenantId, username: u, NOT: { id } }, select: { id: true } });
    if (uClash) return NextResponse.json({ error: 'username_in_use', message: `Username "${u}" is already in use` }, { status: 409 });
    const data: any = { username: u };
    if (pw) {
      if (pw.length < 6) return NextResponse.json({ error: 'password_too_short', message: 'Password must be at least 6 characters' }, { status: 400 });
      data.passwordHash = hashPassword(pw);
    } else if (!target.passwordHash) {
      return NextResponse.json({ error: 'password_required', message: 'Set a password to create this login' }, { status: 400 });
    }
    await prisma.staffUser.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  }

  // Change staff password
  if (action === 'change_password') {
    const isSelf = id === session.staffId;
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');
    const confirmPassword = String(body.confirmPassword ?? '');

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'password_too_short', message: 'New password must be at least 6 characters long.' }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'password_mismatch', message: 'Passwords do not match.' }, { status: 400 });
    }

    if (isSelf && target.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'current_password_required', message: 'Current password is required.' }, { status: 400 });
      }
      const isValid = verifyPassword(currentPassword, target.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'invalid_current_password', message: 'Current password is incorrect.' }, { status: 400 });
      }
    } else if (!isSelf) {
      if (session.role !== 'owner' && session.role !== 'manager') {
        return NextResponse.json({ error: 'forbidden', message: 'Unauthorized to change staff password.' }, { status: 403 });
      }
    }

    const passwordHash = hashPassword(newPassword);
    await prisma.staffUser.update({ where: { id }, data: { passwordHash } });
    await prisma.auditLog.create({
      data: { outletId: session.outletId, actorId: session.staffId, action: isSelf ? 'staff.password_changed' : 'staff.password_reset', entity: 'staff_user', entityId: id, after: { targetName: target.name } }
    }).catch(() => {});
    return NextResponse.json({ ok: true, message: 'Password updated successfully.' });
  }

  // Admin password reset
  if (action === 'reset_password') {
    if (session.role !== 'owner' && session.role !== 'manager') {
      return NextResponse.json({ error: 'forbidden', message: 'Unauthorized to reset staff password.' }, { status: 403 });
    }
    const newPassword = String(body.newPassword ?? '');
    const confirmPassword = String(body.confirmPassword ?? '');
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'password_too_short', message: 'New password must be at least 6 characters long.' }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'password_mismatch', message: 'Passwords do not match.' }, { status: 400 });
    }
    const passwordHash = hashPassword(newPassword);
    await prisma.staffUser.update({ where: { id }, data: { passwordHash } });
    await prisma.auditLog.create({
      data: { outletId: session.outletId, actorId: session.staffId, action: 'staff.password_reset', entity: 'staff_user', entityId: id, after: { targetName: target.name, resetBy: session.staffId } }
    }).catch(() => {});
    return NextResponse.json({ ok: true, message: 'Password reset successfully.' });
  }

  if (action === 'setpin') {
    if (!/^\d{4,6}$/.test(String(body.pin ?? ''))) return NextResponse.json({ error: 'pin_must_be_4_to_6_digits' }, { status: 400 });
    const pinHash = hashPin(String(body.pin));
    const clash = await prisma.staffUser.findFirst({ where: { pinHash, active: true, NOT: { id } }, select: { id: true } });
    if (clash) return NextResponse.json({ error: 'pin_in_use' }, { status: 409 });
    await prisma.staffUser.update({ where: { id }, data: { pinHash } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'remove') {
    if (id === session.staffId) return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 });
    await prisma.staffUser.update({
      where: { id },
      data: { active: false, pinHash: null, username: null, passwordHash: null },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'set_pay') {
    const payType = body.payType === 'monthly' || body.payType === 'hourly' ? body.payType : null;
    const rate = body.payRatePaise == null ? null : Math.round(Number(body.payRatePaise));
    await prisma.staffUser.update({
      where: { id },
      data: { payType, payRatePaise: rate },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const queryId = searchParams.get('id');

  let bodyId: string | undefined;
  try {
    const body = await req.json();
    bodyId = body?.id;
  } catch {}

  const id = queryId || bodyId;
  if (!id) {
    return NextResponse.json({ error: 'missing_id', message: 'Staff ID is required' }, { status: 400 });
  }

  if (id === session.staffId) {
    return NextResponse.json({ error: 'cannot_remove_self', message: 'You cannot remove your own active account' }, { status: 400 });
  }

  try {
    // Attempt soft delete / deactivate to preserve historical integrity
    await prisma.staffUser.update({
      where: { id },
      data: {
        active: false,
        pinHash: null,
        username: null,
        passwordHash: null,
      },
    });

    return NextResponse.json({ ok: true, message: 'Staff account removed successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'failed_to_delete_staff' }, { status: 500 });
  }
}

