import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listAuditLogs, getAuditFilterOptions } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const staffId = sp.get('staffId');
  const action = sp.get('action');
  const entity = sp.get('entity');
  const actorId = sp.get('actorId');
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);

  if (staffId) {
    const isSelf = staffId === session.staffId;
    if (!isSelf && session.role !== 'owner' && session.role !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  } else {
    if (session.role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const list = await listAuditLogs(session.outletId, { action, entity, actorId, staffId, page });
  const filterOptions = page === 1 ? await getAuditFilterOptions(session.outletId, session.tenantId) : undefined;
  return NextResponse.json({ ...list, ...(filterOptions ? { filterOptions } : {}) });
}
