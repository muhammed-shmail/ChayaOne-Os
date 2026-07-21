import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { platformCan } from '@/lib/platform-rbac';
import { platformAudit } from '@/lib/platform-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  planKey: z.enum(['starter', 'growth', 'pro', 'enterprise']),
  period: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly']),
  status: z.enum(['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired']),
  currentEnd: z.string().nullable().optional(), // YYYY-MM-DD
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!platformCan(s.role, 'subscription.write')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const { planKey, period, status, currentEnd } = parsed.data;

  // Find the plan definition by key
  const plan = await prisma.planDefinition.findUnique({
    where: { key: planKey },
  });
  if (!plan) return NextResponse.json({ error: 'plan_not_found' }, { status: 404 });

  // Find current subscription
  const currentSub = await prisma.subscription.findUnique({
    where: { tenantId: params.id },
  });

  const parsedDate = currentEnd ? new Date(`${currentEnd}T00:00:00Z`) : null;

  if (currentSub) {
    await prisma.subscription.update({
      where: { id: currentSub.id },
      data: {
        planId: plan.id,
        period,
        status,
        currentEnd: parsedDate,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        tenantId: params.id,
        planId: plan.id,
        period,
        status,
        currentEnd: parsedDate,
      },
    });
  }

  // Sync tenant base plan field as well for compatibility
  await prisma.tenant.update({
    where: { id: params.id },
    data: { plan: planKey },
  });

  await platformAudit({
    adminId: s.adminId,
    action: 'subscription.update',
    targetTenantId: params.id,
    ip: req.headers.get('x-forwarded-for'),
  });

  return NextResponse.json({ ok: true });
}
