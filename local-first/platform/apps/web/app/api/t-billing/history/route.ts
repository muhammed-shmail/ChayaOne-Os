import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/t-billing/history
 * Fetches billing history for completed/settled orders with search & date filtering.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim().toLowerCase() || '';
  const range = searchParams.get('range') || 'today'; // 'today' | 'yesterday' | '7days' | 'all'
  const method = searchParams.get('method') || 'all';

  const now = new Date();
  let startDate: Date | undefined;

  if (range === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === 'yesterday') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  } else if (range === '7days') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const orders = await prisma.order.findMany({
    where: {
      outletId: session.outletId,
      status: 'settled',
      ...(startDate ? { settledAt: { gte: startDate } } : {}),
      ...(method !== 'all' ? { payments: { some: { method: method as any } } } : {}),
    },
    include: {
      items: true,
      table: { select: { label: true } },
      customer: { select: { name: true, phone: true } },
      payments: { select: { method: true, amountPaise: true, providerRef: true, createdAt: true, meta: true } },
      staff: { select: { name: true } },
    },
    orderBy: { settledAt: 'desc' },
    take: 100,
  });

  // Format response for cashier billing history view
  const formatted = orders
    .map((o) => {
      const year = new Date(o.settledAt || o.placedAt).getFullYear();
      const invoiceNo = (o.payments[0]?.meta as any)?.invoiceNo || `INV-${year}-${String(o.number).padStart(6, '0')}`;
      const methods = Array.from(new Set(o.payments.map((p) => p.method.toUpperCase()))).join(' + ') || 'CASH';

      return {
        id: o.id,
        number: o.number,
        invoiceNo,
        tableName: o.table?.label ?? (o.type === 'takeaway' ? 'Takeaway' : 'Direct'),
        type: o.type,
        customerName: o.customer?.name ?? 'Walk-in Customer',
        customerPhone: o.customer?.phone ?? '',
        cashierName: o.staff?.name ?? 'Staff',
        totalPaise: o.totalPaise,
        subtotalPaise: o.subtotalPaise,
        discountPaise: o.discountPaise,
        cgstPaise: o.cgstPaise,
        sgstPaise: o.sgstPaise,
        placedAt: o.placedAt,
        settledAt: o.settledAt,
        paymentMethods: methods,
        items: o.items.map((i) => ({
          name: i.nameSnapshot,
          qty: i.qty,
          unitPricePaise: i.unitPricePaise,
          linePaise: i.unitPricePaise * i.qty,
        })),
      };
    })
    .filter((b) => {
      if (!q) return true;
      return (
        b.invoiceNo.toLowerCase().includes(q) ||
        String(b.number).includes(q) ||
        b.tableName.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.customerPhone.includes(q)
      );
    });

  return NextResponse.json({ items: formatted });
}
