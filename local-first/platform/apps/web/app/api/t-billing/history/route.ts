import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/t-billing/history
 * Fetches billing history for completed/settled orders with calendar date & sort filtering.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim().toLowerCase() || '';
  const range = searchParams.get('range') || 'today'; // 'today' | 'yesterday' | '7days' | '30days' | 'date' | 'all'
  const dateParam = searchParams.get('date')?.trim() || ''; // 'YYYY-MM-DD'
  const sort = searchParams.get('sort')?.toLowerCase() === 'asc' ? 'asc' : 'desc';
  const method = searchParams.get('method') || 'all';

  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const parts = dateParam.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    }
  } else if (range === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (range === 'yesterday') {
    const yDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    startDate = new Date(yDay.getFullYear(), yDay.getMonth(), yDay.getDate(), 0, 0, 0, 0);
    endDate = new Date(yDay.getFullYear(), yDay.getMonth(), yDay.getDate(), 23, 59, 59, 999);
  } else if (range === '7days') {
    const past7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    startDate = new Date(past7.getFullYear(), past7.getMonth(), past7.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (range === '30days') {
    const past30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    startDate = new Date(past30.getFullYear(), past30.getMonth(), past30.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  const dateFilter = startDate || endDate
    ? {
        settledAt: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      }
    : {};

  const orders = await prisma.order.findMany({
    where: {
      outletId: session.outletId,
      status: 'settled',
      ...dateFilter,
      ...(method !== 'all' ? { payments: { some: { method: method as any } } } : {}),
    },
    include: {
      items: true,
      table: { select: { label: true } },
      customer: { select: { name: true, phone: true } },
      payments: { select: { method: true, amountPaise: true, providerRef: true, createdAt: true, meta: true } },
      staff: { select: { name: true } },
    },
    orderBy: [{ settledAt: sort }, { placedAt: sort }],
    take: 300,
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
        tableLabel: o.table?.label ?? null,
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
        payments: o.payments,
        items: o.items.map((i) => ({
          name: i.nameSnapshot,
          qty: i.qty,
          unitPricePaise: i.unitPricePaise,
          linePaise: i.unitPricePaise * i.qty,
          modifiers: i.modifiers,
          notes: i.notes,
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

  // Compute summary metrics for cashier convenience
  let totalPaise = 0;
  let cashPaise = 0;
  let upiPaise = 0;
  let cardPaise = 0;

  for (const o of formatted) {
    totalPaise += o.totalPaise;
    for (const p of o.payments || []) {
      const m = String(p.method).toLowerCase();
      if (m === 'cash') cashPaise += p.amountPaise;
      else if (m === 'upi') upiPaise += p.amountPaise;
      else if (m === 'card') cardPaise += p.amountPaise;
    }
  }

  const summary = {
    count: formatted.length,
    totalPaise,
    cashPaise,
    upiPaise,
    cardPaise,
  };

  return NextResponse.json({ items: formatted, summary });
}

