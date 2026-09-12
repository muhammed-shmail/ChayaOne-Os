import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { getStoreDashboard, getOrganizationDashboard } from '@/lib/api/analytics';

/**
 * GET /api/owner/dashboard?outletId=<id>
 *
 * If outletId is provided (and authorized): returns store-level KPIs.
 * If outletId is absent: returns org-level aggregated KPIs.
 *
 * Server verifies authorization before any data is returned.
 */
export async function GET(req: NextRequest) {
  const outletId = req.nextUrl.searchParams.get('outletId');

  const auth = await authorizeOwnerRequest(outletId ?? undefined);
  if (!auth.ok) return auth.response;

  try {
    if (outletId) {
      // Single-store dashboard
      const data = await getStoreDashboard(outletId);
      return NextResponse.json({ ...data, mode: 'store', storeId: outletId });
    } else {
      // All authorized stores (org-level)
      const data = await getOrganizationDashboard(auth.authorizedOutletIds);
      return NextResponse.json({ ...data, mode: 'organization' });
    }
  } catch (err) {
    console.error('[dashboard]', err);
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
