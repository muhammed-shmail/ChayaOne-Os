import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  canSettle,
  canVoid,
  canDiscount,
  canTransfer,
  canSplit,
  canMerge,
  canApprove,
  canManageStaff,
} from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me — returns current authenticated user profile, active roles,
 * permissions, and resolved operational capabilities.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    staff: {
      id: session.staffId,
      name: session.name,
      role: session.role,
      roles: session.roles || [session.role],
      permissions: session.permissions,
      effectivePermissions: session.effectivePermissions || [],
      canSettle: canSettle(session),
      canVoid: canVoid(session),
      canDiscount: canDiscount(session),
      canTransfer: canTransfer(session),
      canSplit: canSplit(session),
      canMerge: canMerge(session),
      canApprove: canApprove(session),
      canManageStaff: canManageStaff(session),
    },
  });
}
