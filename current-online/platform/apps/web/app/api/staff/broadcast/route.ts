import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { createNotification } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  message: z.string().trim().min(1).max(280),
  title: z.string().trim().max(80).optional(),
  // Who receives it: 'floor' = all staff (default), 'role' = one team,
  // 'user' = one person. Delivery/targeting is handled by createNotification.
  audience: z.enum(['floor', 'role', 'user']).default('floor'),
  targetRole: z.enum(['manager', 'cashier', 'waiter', 'kitchen']).optional(),
  targetStaffId: z.string().uuid().optional(),
});

/**
 * POST /api/staff/broadcast — owner/manager pushes a message to staff.
 * Aims at everyone on the floor (audience 'floor'), a single team/role
 * (audience 'role' + targetRole), or one person (audience 'user' +
 * targetStaffId). Lands on the recipient's notification bar and — when the
 * app is closed — is delivered via Web Push.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  const { message, title, audience, targetRole, targetStaffId } = parsed.data;

  if (audience === 'role' && !targetRole) return NextResponse.json({ error: 'target_role_required' }, { status: 400 });
  if (audience === 'user' && !targetStaffId) return NextResponse.json({ error: 'target_staff_required' }, { status: 400 });

  // Guard against messaging someone outside this tenant.
  if (audience === 'user') {
    const target = await prisma.staffUser.findFirst({
      where: { id: targetStaffId, tenantId: session.tenantId, active: true },
      select: { id: true },
    });
    if (!target) return NextResponse.json({ error: 'staff_not_found' }, { status: 404 });
  }

  await createNotification({
    outletId: session.outletId,
    type: 'broadcast',
    severity: 'info',
    title: title?.trim() || `Message from ${session.name}`,
    body: message,
    audience,
    targetRole: audience === 'role' ? targetRole : null,
    targetStaffId: audience === 'user' ? targetStaffId : null,
  });

  return NextResponse.json({ ok: true });
}
