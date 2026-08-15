import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ endpoint: z.string().url() });

/** POST /api/staff/push/unsubscribe — drop this device's push subscription. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  // scope the delete to this staff member so one device can't drop another's sub
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, staffId: session.staffId },
  });

  return NextResponse.json({ ok: true });
}
