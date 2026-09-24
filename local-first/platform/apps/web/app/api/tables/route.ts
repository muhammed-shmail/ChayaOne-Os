import { NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getActiveOutlet } from '@/lib/context';
import { readFloors, readTableFloors, readDisabledTables } from '@/lib/floors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tables — floor map for the active outlet, with live occupancy and sections.
 * A table is "occupied" while it has an active dine-in order that hasn't been
 * settled or cancelled (i.e. right up until the bill is paid).
 */
export async function GET() {
  const outlet = await getActiveOutlet();
  const [tables, activeOrders] = await Promise.all([
    prisma.tableMap.findMany({
      where: { outletId: outlet.id },
      orderBy: { label: 'asc' },
      select: { id: true, label: true, seats: true, state: true, qrToken: true },
    }),
    prisma.order.findMany({
      where: {
        outletId: outlet.id,
        tableId: { not: null },
        type: 'dine_in',
        status: { in: ['open', 'in_kitchen', 'ready', 'served'] },
        settledAt: null,
      },
      orderBy: { placedAt: 'asc' },
      select: { id: true, tableId: true, number: true, placedAt: true, totalPaise: true, status: true },
    }),
  ]);

  const settings = (outlet.settings as Record<string, unknown>) ?? {};
  const floors = readFloors(settings);
  const tableFloors = readTableFloors(settings);
  const disabledTables = readDisabledTables(settings);

  // fold the active orders into a per-table occupancy summary
  const occMap = new Map<string, { id: string; orderId: string; number: number; sinceMs: number; billPaise: number; orders: number; status: string }>();
  for (const o of activeOrders) {
    if (!o.tableId) continue;
    const cur = occMap.get(o.tableId);
    if (cur) {
      cur.billPaise += o.totalPaise;
      cur.orders += 1;
      cur.status = o.status;
      cur.id = o.id;
      cur.orderId = o.id;
    } else {
      occMap.set(o.tableId, { id: o.id, orderId: o.id, number: o.number, sinceMs: o.placedAt.getTime(), billPaise: o.totalPaise, orders: 1, status: o.status });
    }
  }

  const occupied = Object.fromEntries(occMap);
  const tableDtos = tables.map((t) => ({
    id: t.id,
    label: t.label,
    seats: t.seats,
    state: t.state,
    qrToken: t.qrToken,
    floorId: tableFloors[t.id] ?? null,
    active: !disabledTables.includes(t.id),
  }));

  return NextResponse.json({ tables: tableDtos, floors, occupied });
}
