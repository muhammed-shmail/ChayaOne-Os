import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/**
 * POST /api/staff/push/subscribe — store this device's Web Push subscription.
 * Upserts by endpoint, bound to the current staff member + device session, so
 * the notify dispatcher can reach this phone when the app is closed.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });

  const { endpoint, keys } = parsed.data;
  const data = {
    tenantId: session.tenantId,
    staffId: session.staffId,
    sessionId: session.sid ?? null,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent: req.headers.get('user-agent') ?? undefined,
    lastUsedAt: new Date(),
  };

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, ...data },
    update: data, // re-bind if the same endpoint reappears on another login
  });

  return NextResponse.json({ ok: true });
}
