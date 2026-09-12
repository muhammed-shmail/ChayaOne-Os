import { NextResponse } from 'next/server';
import { getSession, type OwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Server-side authorization for every Owner API route.
 *
 * Authorization chain:
 *   1. Verify JWT session → authenticated user
 *   2. Verify role is owner/manager/accountant
 *   3. If outletId requested → verify user has access to that outlet
 *   4. Verify tenant match (cross-tenant isolation)
 *
 * Never trust frontend-supplied tenantId/outletId without this verification.
 */

export type AuthResult =
  | { ok: true; session: OwnerSession; authorizedOutletIds: string[]; response?: undefined }
  | { ok: false; response: NextResponse; session?: undefined; authorizedOutletIds?: undefined };

/**
 * Authorize an incoming API request.
 *
 * @param requestedOutletId — if provided, verify the user can access this specific outlet.
 *   Pass null/undefined for org-level queries.
 */
export async function authorizeOwnerRequest(
  requestedOutletId?: string | null,
): Promise<AuthResult> {
  const session = await getSession();

  // 1. Authentication check
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // 2. Role check — only owner/manager/accountant may access Owner Dashboard
  const allowedRoles = ['owner', 'manager', 'accountant'];
  if (!allowedRoles.includes(session.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  // 3. Determine which outlets this user is authorized to access
  let authorizedOutletIds: string[];

  if (session.outletId === null) {
    // Tenant-wide access: fetch all outlets for this tenant
    const outlets = await prisma.outlet.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true },
    });
    authorizedOutletIds = outlets.map((o) => o.id);
  } else {
    // Single-outlet access
    authorizedOutletIds = [session.outletId];
  }

  // 4. If a specific outlet was requested, verify authorization
  if (requestedOutletId) {
    if (!authorizedOutletIds.includes(requestedOutletId)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Forbidden: you do not have access to this store' },
          { status: 403 },
        ),
      };
    }
  }

  return { ok: true, session, authorizedOutletIds };
}

/**
 * Verify that a given tenantId matches the session's tenantId.
 * Use this to prevent cross-tenant data leakage.
 */
export function assertTenantMatch(
  session: OwnerSession,
  tenantId: string,
): NextResponse | null {
  if (session.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
