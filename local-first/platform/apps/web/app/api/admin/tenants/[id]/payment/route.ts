import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { platformCan } from '@/lib/platform-rbac';
import { platformAudit } from '@/lib/platform-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  customPaymentEnabled: z.boolean(),
  razorpayKeyId: z.string().max(100).nullable().optional(),
  razorpayKeySecret: z.string().max(100).nullable().optional(),
});

/** PATCH /api/admin/tenants/[id]/payment — set per-tenant custom payment gateway settings. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!platformCan(s.role, 'tenants.lifecycle')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input', detail: parsed.error.flatten() }, { status: 400 });

  const { customPaymentEnabled, razorpayKeyId, razorpayKeySecret } = parsed.data;

  const updated = await prisma.tenant.update({
    where: { id: params.id },
    data: {
      customPaymentEnabled,
      razorpayKeyId: razorpayKeyId || null,
      razorpayKeySecret: razorpayKeySecret || null,
    },
  });

  await platformAudit({
    adminId: s.adminId,
    action: 'tenant.payment_update',
    targetTenantId: params.id,
    meta: { customPaymentEnabled },
    ip: req.headers.get('x-forwarded-for'),
  });

  return NextResponse.json({ ok: true, tenant: updated });
}
