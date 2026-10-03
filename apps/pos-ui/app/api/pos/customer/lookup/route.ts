import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { hashPhone, isValidPhone, normalizePhone } from '@/lib/phone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pos/customer/lookup?phone=...
 *
 * Staff POS helper: recognize returning walk-in customers by normalized phone.
 * Phone remains the loyalty/CRM unique key at the application layer via
 * `(tenantId, phoneHash)`, while the POS can auto-fill the saved name.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const phone = normalizePhone(req.nextUrl.searchParams.get('phone') ?? '');
  if (phone.length < 3) return NextResponse.json({ customer: null, customers: [] });

  const customer = isValidPhone(phone) ? await prisma.customer.findFirst({
    where: { tenantId: session.tenantId, phoneHash: hashPhone(phone) },
    select: { id: true, name: true, phone: true, tier: true, points: true, visitCount: true },
  }) : null;

  const customers = await prisma.customer.findMany({
    where: { tenantId: session.tenantId, phone: { contains: phone } },
    orderBy: { lastVisit: 'desc' },
    take: 6,
    select: { id: true, name: true, phone: true, tier: true, points: true, visitCount: true },
  });

  return NextResponse.json({ customer, customers });
}
