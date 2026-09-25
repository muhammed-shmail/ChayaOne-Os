import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma, type Prisma, type StaffRole } from '@cafeos/db';
import { getSession, invalidateStaffCache } from '@/lib/auth';
import { canManageStaff, assignableRoles, canManageTarget, ALL_ROLES, resolvePrimaryRole, hasRole, hasPermission } from '@/lib/rbac';
import { hashPassword } from '@/lib/crypto';
import { assertSlot, bumpUsage, SlotExceeded } from '@/lib/limits';
import { publish } from '@/lib/realtime';
import { parseRupeesToPaise } from '@cafeos/core';


import { readWaiterStations, type WaiterStation } from '@/lib/waiter-stations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isRole = (r: unknown): r is StaffRole => typeof r === 'string' && (ALL_ROLES as string[]).includes(r);
const hashPin = (pin: string) => createHash('sha256').update(pin).digest('hex');
// username or email: 1-60 chars, starts alphanumeric, then letters/digits/._-@+ (case-insensitive, stored lowercase)
const USERNAME_RE = /^[a-z0-9][a-z0-9._@+-]{0,59}$/i;

/** GET /api/staff — staff users for the tenant (manager/owner only). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageStaff(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const [rows, customRoles, outlet] = await Promise.all([
    prisma.staffUser.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, role: true, phone: true, active: true, employeeCode: true, payType: true, payRatePaise: true, pinHash: true, username: true, passwordHash: true, permissions: true },
    }),
    prisma.role.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { name: 'asc' },
    }).catch(() => []),
    session.outletId
      ? prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } }).catch(() => null)
      : null,
  ]);
  const waiterStations = readWaiterStations(outlet?.settings);
  const members = rows.map(({ pinHash, passwordHash, ...m }) => ({ ...m, hasPin: !!pinHash, hasLogin: !!passwordHash }));
  return NextResponse.json({ members, assignable: assignableRoles(session), customRoles, waiterStations });
}

/**
 * POST /api/staff — manage staff users.
 *  { action: 'create', name, role, phone?, username, password, payType?, payRatePaise?, permissions? }
 *  { action: 'update', id, role?, permissions?, active? }
 *  { action: 'setpin', id, pin }
 *  { action: 'remove', id }   // soft-delete (active=false) to preserve order history
 *  { action: 'create_custom_role', name, baseRole, permissions }
 *  { action: 'delete_custom_role', id }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageStaff(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ---- Custom Role Management ----
  if (action === 'create_custom_role') {
    const { name, baseRole, permissions } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'name_required' }, { status: 400 });
    const trimmedName = String(name).trim();
    const validBaseRole = isRole(baseRole) ? baseRole : (baseRole === 'none' ? 'none' : 'waiter');

    const roleData = {
      tenantId: session.tenantId,
      name: trimmedName,
      permissions: {
        baseRole: validBaseRole,
        ...(typeof permissions === 'object' && permissions !== null ? permissions : {}),
      },
    };

    try {
      const created = await prisma.role.create({ data: roleData });
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

  // ---- Waiter Station Management ----
  if (action === 'create_waiter_station' || action === 'update_waiter_station') {
    const { code, name, desc, originalId } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'name_required' }, { status: 400 });
    const outlet = session.outletId
      ? await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } })
      : null;
    const current = readWaiterStations(outlet?.settings);
    const rawCode = (code || name.slice(0, 4)).trim().toUpperCase();
    const id = rawCode.toLowerCase();
    const cleanName = name.trim();
    const updatedStation: WaiterStation = {
      id,
      code: rawCode,
      name: cleanName,
      label: `${rawCode} (${cleanName})`,
      desc: desc?.trim() || 'Floor Section Station',
      isCustom: true,
    };
    const targetToRemove = (originalId || id).trim().toLowerCase();
    const next = [...current.filter((s) => s.id.toLowerCase() !== targetToRemove && s.id.toLowerCase() !== id), updatedStation];
    if (session.outletId) {
      const prevSettings = (outlet?.settings as Record<string, unknown>) || {};
      await prisma.outlet.update({
        where: { id: session.outletId },
        data: { settings: { ...prevSettings, waiterStations: next } as any },
      });
    }
    return NextResponse.json({ ok: true, waiterStations: next, station: updatedStation });
  }

  if (action === 'delete_waiter_station') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    const outlet = session.outletId
      ? await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } })
      : null;
    const current = readWaiterStations(outlet?.settings);
    const targetId = id.trim().toLowerCase();
    const next = current.filter((s) => s.id.toLowerCase() !== targetId && s.code.toLowerCase() !== targetId);
    if (session.outletId) {
      const prevSettings = (outlet?.settings as Record<string, unknown>) || {};
      await prisma.outlet.update({
        where: { id: session.outletId },
        data: { settings: { ...prevSettings, waiterStations: next } as any },
      });
    }
    return NextResponse.json({ ok: true, waiterStations: next });
  }

  if (action === 'create') {
    const { name, role, phone, employeeCode, pin } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

    const rawAssignedRoles: string[] = Array.isArray(body.permissions?.assignedRoles) && body.permissions.assignedRoles.length > 0
      ? body.permissions.assignedRoles
      : [role || 'waiter'];
    const isNone = body.baseRole === 'none' || rawAssignedRoles.includes('none');
    const resolvedRole = isNone ? 'waiter' : resolvePrimaryRole(rawAssignedRoles, isRole(role) ? role : 'waiter');

    if (!isRole(resolvedRole) || !assignableRoles(session).includes(resolvedRole)) {
      return NextResponse.json({ error: 'role_not_allowed' }, { status: 403 });
    }

    // PIN handling (POS quick access)
    let pinHash: string | null = null;
    if (pin && /^\d{4,6}$/.test(String(pin))) {
      pinHash = hashPin(String(pin));
      const clash = await prisma.staffUser.findFirst({ where: { pinHash, active: true }, select: { id: true } });
      if (clash) return NextResponse.json({ error: 'pin_in_use' }, { status: 409 });
    }

    // Username + password are required for dashboard login (no random/default PINs)
    const u = String(body.username ?? '').trim().toLowerCase();
    const pw = String(body.password ?? '');
    if (!u) return NextResponse.json({ error: 'invalid_username', message: 'Username or Email is required.' }, { status: 400 });
    if (!USERNAME_RE.test(u)) return NextResponse.json({ error: 'invalid_username', message: 'Username must be 2–60 characters (letters, numbers, ., _, @, -).' }, { status: 400 });
    if (pw.length < 6) return NextResponse.json({ error: 'password_too_short', message: 'Password must be at least 6 characters.' }, { status: 400 });
    const uClash = await prisma.staffUser.findFirst({ where: { tenantId: session.tenantId, username: u }, select: { id: true } });
    if (uClash) return NextResponse.json({ error: 'username_in_use', message: `Username "${u}" is already in use. Please choose another.` }, { status: 409 });
    const username = u;
    const passwordHash = hashPassword(pw);

    // Optional pay configuration at creation time
    const payType = body.payType === 'monthly' || body.payType === 'hourly' ? body.payType : null;
    const payRatePaise = body.payRatePaise != null ? Math.round(Number(body.payRatePaise)) : null;

    // slot enforcement: staff seats per plan
    try {
      await assertSlot(session.tenantId, 'staff');
    } catch (e) {
      if (e instanceof SlotExceeded) return NextResponse.json({ error: 'slot_exceeded', metric: e.metric, limit: e.limit, upsell: true }, { status: 402 });
      throw e;
    }

    const permissionsData = body.permissions
      ? { ...body.permissions }
      : { assignedRoles: rawAssignedRoles, branchAccess: ['main-branch'], overrides: {}, dataRestrictions: [] };

    if (body.customRole) {
      permissionsData.customRole = body.customRole;
      if (!permissionsData.assignedRoles.includes(body.customRole)) {
        permissionsData.assignedRoles = [body.customRole, ...permissionsData.assignedRoles];
      }
    }
    if (body.designation) {
      permissionsData.designation = body.designation;
    }
    if (body.joiningDate) {
      permissionsData.joiningDate = body.joiningDate;
    }
    if (isNone) {
      permissionsData.baseRole = 'none';
    }
    if (body.station) {
      permissionsData.station = body.station;
    }
    if (body.stationName) {
      permissionsData.stationName = body.stationName;
    }

    // Ensure staff always has a valid outletId linked to their tenant
    let targetOutletId: string | undefined = session.outletId || undefined;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({ where: { tenantId: session.tenantId }, select: { id: true } });
      targetOutletId = defaultOutlet?.id || undefined;
    }

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
        permissions: permissionsData as Prisma.InputJsonValue,
      },
      select: { id: true, name: true, role: true, phone: true, active: true, employeeCode: true, payType: true, payRatePaise: true, permissions: true },
    });

    invalidateStaffCache(created.id);
    if (targetOutletId) {
      await publish(targetOutletId, { type: 'staff.updated', staffId: created.id }).catch(() => {});
    }

    // Create optional first shift if provided
    if (body.shiftStartsAt && body.shiftEndsAt && targetOutletId) {
      const start = new Date(body.shiftStartsAt);
      const end = new Date(body.shiftEndsAt);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
        await prisma.shift.create({
          data: { outletId: targetOutletId, staffId: created.id, startsAt: start, endsAt: end, role: resolvedRole, status: 'scheduled' },
        }).catch(() => {});
      }
    }

    await bumpUsage(session.tenantId, 'staff').catch(() => {});
    await audit(session, 'staff.created', created.id, { name: created.name, role: created.role });
    return NextResponse.json({ ok: true, member: { ...created, hasPin: !!pinHash, hasLogin: true } });
  }

  // ---- shifts (roster) — subject is body.staffId ----
  if (action === 'shift_add' || action === 'shift_remove') {
    if (action === 'shift_remove') {
      if (!body.shiftId) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
      await prisma.shift.deleteMany({ where: { id: body.shiftId, outletId: session.outletId } });
      return NextResponse.json({ ok: true });
    }
    const { staffId, startsAt, endsAt, role } = body;
    const staff = await prisma.staffUser.findFirst({ where: { id: staffId, tenantId: session.tenantId }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const start = new Date(startsAt), end = new Date(endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return NextResponse.json({ error: 'invalid_times' }, { status: 400 });
    const shift = await prisma.shift.create({
      data: { outletId: session.outletId, staffId, startsAt: start, endsAt: end, role: role ? String(role) : null, status: 'scheduled' },
      select: { id: true, staffId: true, startsAt: true, endsAt: true, role: true },
    });
    await audit(session, 'shift.added', staffId, { shiftId: shift.id, startsAt, endsAt });
    return NextResponse.json({ ok: true, shift });
  }

  // all remaining actions target an existing user
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  const target = await prisma.staffUser.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canManageTarget(session, target.role)) return NextResponse.json({ error: 'cannot_manage_this_user' }, { status: 403 });

  if (action === 'update') {
    const data: Prisma.StaffUserUpdateInput = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.employeeCode !== undefined) data.employeeCode = body.employeeCode ? String(body.employeeCode).trim() : null;

    if (body.permissions !== undefined) {
      data.permissions = body.permissions as Prisma.InputJsonValue;
      if (Array.isArray(body.permissions?.assignedRoles) && body.permissions.assignedRoles.length > 0) {
        const primary = resolvePrimaryRole(body.permissions.assignedRoles, body.role || target.role);
        if (assignableRoles(session).includes(primary)) {
          data.role = primary;
        }
      }
    }

    if (body.station !== undefined) {
      const prevPerms = (typeof (data.permissions || target.permissions) === 'object' && (data.permissions || target.permissions)
        ? (data.permissions || target.permissions)
        : {}) as Record<string, any>;
      data.permissions = {
        ...prevPerms,
        station: body.station ? String(body.station).trim() : null,
        stationName: body.stationName ? String(body.stationName).trim() : null,
      } as Prisma.InputJsonValue;
    }

    if (body.role !== undefined && !data.role) {
      let dbRole = body.role;
      if (dbRole === 'delivery') dbRole = 'waiter';
      if (dbRole === 'inventory') dbRole = 'cashier';
      if (!isRole(dbRole) || !assignableRoles(session).includes(dbRole)) {
        return NextResponse.json({ error: 'role_not_allowed' }, { status: 403 });
      }
      data.role = dbRole;
    }

    if (body.active !== undefined) {
      // never let an admin lock themselves out
      if (id === session.staffId && body.active === false) {
        return NextResponse.json({ error: 'cannot_deactivate_self' }, { status: 400 });
      }
      data.active = !!body.active;
    }

    const updated = await prisma.staffUser.update({
      where: { id },
      data,
      select: { id: true, name: true, role: true, phone: true, active: true, employeeCode: true, payType: true, payRatePaise: true, permissions: true },
    });

    invalidateStaffCache(id);
    if (session.outletId) {
      await publish(session.outletId, { type: 'staff.updated', staffId: id }).catch(() => {});
    }

    await audit(session, 'staff.updated', id, { role: updated.role, active: updated.active });
    return NextResponse.json({ ok: true, member: { ...updated, hasPin: !!target.pinHash } });
  }

  // ---- pay configuration (rate + employee code) ----
  if (action === 'set_pay') {
    const payType = body.payType === 'monthly' || body.payType === 'hourly' ? body.payType : null;
    const rate = body.payRatePaise === null || body.payRatePaise === undefined ? null : Math.round(Number(body.payRatePaise));
    if (rate !== null && (!Number.isFinite(rate) || rate < 0)) return NextResponse.json({ error: 'invalid_rate' }, { status: 400 });
    const data: Prisma.StaffUserUpdateInput = { payType, payRatePaise: rate };
    if (body.employeeCode !== undefined) data.employeeCode = body.employeeCode ? String(body.employeeCode).trim() : null;
    const updated = await prisma.staffUser.update({ where: { id }, data, select: { id: true, name: true, role: true, phone: true, active: true, employeeCode: true, payType: true, payRatePaise: true } });
    invalidateStaffCache(id);
    await audit(session, 'staff.pay_set', id, { payType, payRatePaise: rate });
    return NextResponse.json({ ok: true, member: { ...updated, hasPin: !!target.pinHash } });
  }

  // ---- record a salary / wage payment ----
  if (action === 'pay_record') {
    if (!hasRole(session, ['owner', 'manager']) && !hasPermission(session, 'staff:payroll:approve') && !hasPermission(session, 'staff:payroll:edit')) {
      return NextResponse.json({ error: 'forbidden', message: 'Unauthorized to record salary payments' }, { status: 403 });
    }

    let amountPaise = 0;
    if (body.amountPaise !== undefined) {
      amountPaise = typeof body.amountPaise === 'number' ? Math.round(body.amountPaise) : parseRupeesToPaise(body.amountPaise);
    } else if (body.amountRupees !== undefined || body.amount !== undefined) {
      amountPaise = parseRupeesToPaise(body.amountRupees ?? body.amount);
    }
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });

    const method = ['cash', 'upi', 'bank'].includes(body.method) ? body.method : 'cash';
    const periodLabel = String(body.periodLabel ?? '').trim() || new Date().toISOString().slice(0, 7);

    // Duplicate submission prevention: reject identical payout within 60s
    const recentDup = await prisma.salaryPayment.findFirst({
      where: {
        outletId: session.outletId,
        staffId: id,
        periodLabel,
        amountPaise,
        paidAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
      select: { id: true, paidAt: true },
    });
    if (recentDup) {
      return NextResponse.json(
        { error: 'duplicate_payout_detected', message: 'A payout with this exact amount was just recorded. Duplicate submission prevented.' },
        { status: 409 }
      );
    }

    // Overpayment / duplicate full salary period check
    if (body.allowOverpay !== true && target.payType === 'monthly' && target.payRatePaise) {
      const existingPeriodPayments = await prisma.salaryPayment.findMany({
        where: { outletId: session.outletId, staffId: id, periodLabel },
        select: { amountPaise: true },
      });
      const totalAlreadyPaid = existingPeriodPayments.reduce((sum, p) => sum + p.amountPaise, 0);
      if (totalAlreadyPaid >= target.payRatePaise) {
        return NextResponse.json(
          {
            error: 'salary_already_paid',
            message: `Monthly salary has already been fully paid for ${periodLabel}. Confirm if this is an additional bonus or advance payment.`,
            totalPaidPaise: totalAlreadyPaid,
          },
          { status: 409 }
        );
      }
    }

    const pay = await prisma.salaryPayment.create({
      data: { outletId: session.outletId, staffId: id, periodLabel, amountPaise, method, note: body.note ? String(body.note).trim() : null, createdById: session.staffId },
      select: { id: true, periodLabel: true, amountPaise: true, method: true, paidAt: true },
    });
    await audit(session, 'staff.salary_paid', id, { periodLabel, amountPaise, method });
    return NextResponse.json({ ok: true, payment: pay });
  }

  // ---- manager manual attendance punch ----
  if (action === 'attendance_punch') {
    const punchAction = body.punchAction === 'out' ? 'out' : 'in';
    let open = await prisma.attendance.findFirst({
      where: { outletId: session.outletId, staffId: id, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });

    if (punchAction === 'in') {
      if (open && Date.now() - open.clockIn.getTime() > 16 * 3600 * 1000) {
        await prisma.attendance.update({
          where: { id: open.id },
          data: { clockOut: new Date(open.clockIn.getTime() + 8 * 3600 * 1000) },
        }).catch(() => {});
        open = null;
      } else if (open) {
        return NextResponse.json({ ok: true, message: `${target.name} is already clocked in`, open: { id: open.id, clockIn: open.clockIn.toISOString() } });
      }
      const rec = await prisma.attendance.create({
        data: { outletId: session.outletId, staffId: id, clockIn: new Date(), source: 'manager_punch' },
        select: { id: true, clockIn: true },
      });
      await audit(session, 'attendance.manager_clock_in', id, { name: target.name, punchId: rec.id });
      return NextResponse.json({ ok: true, punch: rec });
    } else {
      if (!open) {
        return NextResponse.json({ ok: true, message: `${target.name} is already clocked out` });
      }
      await prisma.attendance.update({
        where: { id: open.id },
        data: { clockOut: new Date() },
      });
      await audit(session, 'attendance.manager_clock_out', id, { name: target.name, punchId: open.id });
      return NextResponse.json({ ok: true, message: `${target.name} clocked out successfully` });
    }
  }

  if (action === 'setpin') {
    if (!/^\d{4,6}$/.test(String(body.pin ?? ''))) return NextResponse.json({ error: 'pin_must_be_4_to_6_digits' }, { status: 400 });
    const pinHash = hashPin(String(body.pin));
    const clash = await prisma.staffUser.findFirst({ where: { pinHash, active: true, NOT: { id } }, select: { id: true } });
    if (clash) return NextResponse.json({ error: 'pin_in_use' }, { status: 409 });
    await prisma.staffUser.update({ where: { id }, data: { pinHash } });
    invalidateStaffCache(id);
    if (session.outletId) {
      await publish(session.outletId, { type: 'staff.updated', staffId: id }).catch(() => {});
    }
    await audit(session, 'staff.pin_reset', id, {});
    return NextResponse.json({ ok: true });
  }

  // set / change / clear the username + password login for an existing staff member
  if (action === 'setlogin') {
    const u = String(body.username ?? '').trim().toLowerCase();
    const pw = String(body.password ?? '');
    // empty username clears password login entirely
    if (!u) {
      await prisma.staffUser.update({ where: { id }, data: { username: null, passwordHash: null } });
      invalidateStaffCache(id);
      await audit(session, 'staff.login_cleared', id, {});
      return NextResponse.json({ ok: true });
    }
    if (!USERNAME_RE.test(u)) return NextResponse.json({ error: 'invalid_username', message: 'Username must be 2–60 characters (letters, numbers, ., _, @, -).' }, { status: 400 });
    const uClash = await prisma.staffUser.findFirst({ where: { tenantId: session.tenantId, username: u, NOT: { id } }, select: { id: true } });
    if (uClash) return NextResponse.json({ error: 'username_in_use', message: `Username "${u}" is already in use. Please choose another.` }, { status: 409 });
    const data: Prisma.StaffUserUpdateInput = { username: u };
    if (!target.outletId && session.outletId) {
      data.outletId = session.outletId;
    }
    // password optional: only change it when provided, so the username can be renamed alone
    if (pw) {
      if (pw.length < 6) return NextResponse.json({ error: 'password_too_short', message: 'Password must be at least 6 characters.' }, { status: 400 });
      data.passwordHash = hashPassword(pw);
    } else if (!target.passwordHash) {
      return NextResponse.json({ error: 'password_required', message: 'Set a password to create this login.' }, { status: 400 });
    }
    await prisma.staffUser.update({ where: { id }, data });
    invalidateStaffCache(id);
    if (session.outletId) {
      await publish(session.outletId, { type: 'staff.updated', staffId: id }).catch(() => {});
    }
    await audit(session, 'staff.login_set', id, { username: u });
    return NextResponse.json({ ok: true });
  }

  if (action === 'remove') {
    if (id === session.staffId) return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 });
    invalidateStaffCache(id);
    if (session.outletId) {
      await publish(session.outletId, { type: 'staff.updated', staffId: id }).catch(() => {});
    }
    try {
      await prisma.staffUser.delete({ where: { id } });
      await audit(session, 'staff.deleted', id, { name: target.name });
      return NextResponse.json({ ok: true, deleted: true });
    } catch (e) {
      const updated = await prisma.staffUser.update({
        where: { id },
        data: { active: false, pinHash: null, username: null, passwordHash: null },
        select: { id: true, name: true, role: true, phone: true, active: true, permissions: true }
      });
      await audit(session, 'staff.removed', id, { name: updated.name });
      return NextResponse.json({ ok: true, member: updated });
    }
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageStaff(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  if (id === session.staffId) return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 });

  const target = await prisma.staffUser.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canManageTarget(session, target.role)) return NextResponse.json({ error: 'cannot_manage_this_user' }, { status: 403 });

  invalidateStaffCache(id);
  if (session.outletId) {
    await publish(session.outletId, { type: 'staff.updated', staffId: id }).catch(() => {});
  }
  try {
    await prisma.staffUser.delete({ where: { id } });
    await audit(session, 'staff.deleted', id, { name: target.name });
    return NextResponse.json({ ok: true, deleted: true });
  } catch {
    const updated = await prisma.staffUser.update({
      where: { id },
      data: { active: false, pinHash: null, username: null, passwordHash: null },
      select: { id: true, name: true, role: true, phone: true, active: true, permissions: true }
    });
    await audit(session, 'staff.removed', id, { name: updated.name });
    return NextResponse.json({ ok: true, member: updated });
  }
}

async function audit(session: { outletId: string; staffId: string }, action: string, entityId: string, after: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: { outletId: session.outletId, actorId: session.staffId, action, entity: 'staff_user', entityId, after: after as Prisma.InputJsonValue },
  }).catch(() => {});
}
