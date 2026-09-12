import { NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { resolveOwnerContext } from '@/lib/api/owner-context';

/**
 * GET /api/owner/context
 * Returns the authenticated user's organization and authorized stores.
 * This is the bootstrap call made when the app loads.
 *
 * Response is cached client-side in React state (not IndexedDB) since it
 * changes only on role changes — a session refresh picks those up.
 */
export async function GET() {
  const auth = await authorizeOwnerRequest();
  if (!auth.ok) return auth.response;

  const context = await resolveOwnerContext(auth.session);
  if (!context) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  return NextResponse.json(context);
}
