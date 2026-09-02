import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { resolveTable } from '@/lib/customer';
import { readGstConfig } from '@/lib/tax';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/customer/bill?t=<qrToken>
 * Public customer endpoint to view the authoritative, server-computed bill summary for their table.
 */
export async function GET(req: NextRequest) {
  const qrToken = req.nextUrl.searchParams.get('t');
  if (!qrToken) {
    return NextResponse.json({ error: 'missing_qr_token' }, { status: 400 });
  }

  const table = await resolveTable(qrToken);
  if (!table) {
    return NextResponse.json({ error: 'table_not_found' }, { status: 404 });
  }

  const outlet = table.outlet;

  // Find active orders on this table (or most recent un-settled order)
  const orders = await prisma.order.findMany({
    where: {
      tableId: table.id,
      status: { in: ['open', 'in_kitchen', 'ready', 'served', 'pending_approval'] },
    },
    include: {
      items: {
        include: {
          item: { select: { name: true, gstRate: true } },
        },
      },
    },
    orderBy: { placedAt: 'asc' },
  });

  let subtotalPaise = 0;
  let discountPaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let totalPaise = 0;
  const aggregatedItems: Array<{
    name: string;
    qty: number;
    unitPricePaise: number;
    totalPaise: number;
    modifiers: any;
    notes?: string | null;
  }> = [];

  for (const o of orders) {
    subtotalPaise += o.subtotalPaise;
    discountPaise += o.discountPaise;
    cgstPaise += o.cgstPaise;
    sgstPaise += o.sgstPaise;
    igstPaise += o.igstPaise;
    totalPaise += o.totalPaise;

    for (const it of o.items) {
      aggregatedItems.push({
        name: it.nameSnapshot,
        qty: it.qty,
        unitPricePaise: it.unitPricePaise,
        totalPaise: it.unitPricePaise * it.qty,
        modifiers: it.modifiers,
        notes: it.notes,
      });
    }
  }

  const outletRecord = await prisma.outlet.findUnique({
    where: { id: table.outlet.id },
    select: { id: true, name: true, settings: true },
  });
  const outletSettings = outletRecord?.settings ?? {};
  const gstConfig = readGstConfig(outletSettings);
  const upiId = (outletSettings as any)?.payment?.upiId || (outletSettings as any)?.upiVpa || null;
  const totalRupees = (totalPaise / 100).toFixed(2);

  let upiString: string | null = null;
  if (upiId && totalPaise > 0) {
    const outletNameEncoded = encodeURIComponent((outletRecord?.name || outlet.name).replace(/[^a-zA-Z0-9 ]/g, ''));
    upiString = `upi://pay?pa=${upiId}&pn=${outletNameEncoded}&am=${totalRupees}&cu=INR&tn=Table%20${encodeURIComponent(table.label)}`;
  }

  return NextResponse.json({
    tableLabel: table.label,
    outletName: outlet.name,
    orderCount: orders.length,
    items: aggregatedItems,
    financials: {
      subtotalPaise,
      discountPaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      totalPaise,
      subtotalRupees: (subtotalPaise / 100).toFixed(2),
      discountRupees: (discountPaise / 100).toFixed(2),
      taxRupees: ((cgstPaise + sgstPaise + igstPaise) / 100).toFixed(2),
      totalRupees,
    },
    gstConfig,
    upi: {
      upiId,
      upiString,
    },
  });
}
