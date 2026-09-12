import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const open = await prisma.attendance.findFirst({
    where: { outletId: session.outletId, staffId: session.staffId, clockOut: null },
    orderBy: { clockIn: 'desc' },
    select: { id: true, clockIn: true },
  });

  return NextResponse.json({
    open: open ? { id: open.id, clockIn: open.clockIn.toISOString() } : null,
    geoRequired: false,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (action !== 'in' && action !== 'out') return NextResponse.json({ error: 'invalid_action' }, { status: 400 });

  const staffId = body.staffId || session.staffId;

  const open = await prisma.attendance.findFirst({
    where: { outletId: session.outletId, staffId, clockOut: null },
    orderBy: { clockIn: 'desc' },
  });

  if (action === 'in') {
    if (open) return NextResponse.json({ ok: true, attendance: open, already: true });
    const row = await prisma.attendance.create({
      data: { outletId: session.outletId, staffId, clockIn: new Date(), source: 'pin' },
    });
    return NextResponse.json({ ok: true, attendance: row });
  } else {
    if (!open) return NextResponse.json({ ok: true, already: true });
    const row = await prisma.attendance.update({
      where: { id: open.id },
      data: { clockOut: new Date() },
    });
    return NextResponse.json({ ok: true, attendance: row });
  }
}
