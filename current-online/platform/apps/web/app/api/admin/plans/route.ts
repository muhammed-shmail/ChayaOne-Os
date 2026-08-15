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
  priceMonthly: z.number().nonnegative(),
  priceYearly: z.number().nonnegative(),
});

export async function PUT(req: NextRequest) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!platformCan(s.role, 'plans.write')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const { planKey, priceMonthly, priceYearly } = parsed.data;

  // Convert to paise
  const pricePaise = {
    monthly: Math.round(priceMonthly * 100),
    yearly: Math.round(priceYearly * 100),
  };

  const updatedPlan = await prisma.planDefinition.update({
    where: { key: planKey },
    data: { pricePaise },
  });

  await platformAudit({
    adminId: s.adminId,
    action: 'plan.price_update',
    ip: req.headers.get('x-forwarded-for'),
  });

  return NextResponse.json({ ok: true, plan: updatedPlan });
}
