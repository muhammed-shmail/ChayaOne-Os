import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSectionData, type SectionName } from '@/lib/sections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECTIONS: SectionName[] = ['monitor', 'sales', 'inventory', 'suppliers', 'tables', 'staff', 'loyalty', 'marketing', 'menu', 'settings', 'pwa'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager' && session.role !== 'cashier' && session.role !== 'accountant')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const s = req.nextUrl.searchParams.get('s') as SectionName | null;
  if (!s || !SECTIONS.includes(s)) return NextResponse.json({ error: 'unknown section' }, { status: 400 });

  const requestedOutlet = req.nextUrl.searchParams.get('outletId');
  const outletId = requestedOutlet || session.outletId;

  const result = await getSectionData(s, outletId, session.tenantId);
  return NextResponse.json(result);
}
