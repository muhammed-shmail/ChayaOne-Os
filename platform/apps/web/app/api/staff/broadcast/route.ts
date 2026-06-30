import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { createNotification } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  message: z.string().trim().min(1).max(280),
  title: z.string().trim().max(80).optional(),
});

/**
 * POST /api/staff/broadcast — owner/manager pushes a message to all floor staff.
 * Lands on every staff member's notification bar (audience 'floor'); Phase 3
 * also delivers it via Web Push when the app is closed.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  await createNotification({
    outletId: session.outletId,
    type: 'broadcast',
    severity: 'info',
    title: parsed.data.title?.trim() || `Message from ${session.name}`,
    body: parsed.data.message,
    audience: 'floor',
  });

  return NextResponse.json({ ok: true });
}
