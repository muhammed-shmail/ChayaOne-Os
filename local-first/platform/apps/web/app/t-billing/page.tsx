import { redirect } from 'next/navigation';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canAccess, landingFor } from '@/lib/rbac';
import { readGstConfig } from '@/lib/tax';
import { readTableFloors } from '@/lib/floors';
import { readReceiptConfig } from '@/lib/receipt';
import { readUpiConfig } from '@/lib/print/upi';
import { readKitchenWorkflow } from '@/lib/kitchenWorkflow';
import TBillingClient, { type TableDto } from './TBillingClient';

export const revalidate = 0;

/** Server component: T-Billing page — loads outlet settings, tables, and active orders for the cashier workspace. */
export default async function TBillingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canAccess(session, 'pos')) redirect(landingFor(session));

  const outlet = await prisma.outlet.findUnique({ where: { id: session.outletId } });
  if (!outlet) redirect('/api/auth/logout');

  const [tables, initialOrdersRaw] = await Promise.all([
    prisma.tableMap.findMany({ where: { outletId: outlet.id }, orderBy: { label: 'asc' } }),
    prisma.order.findMany({
      where: {
        outletId: outlet.id,
        status: { in: ['open', 'in_kitchen', 'ready', 'served'] },
      },
      include: {
        items: {
          include: {
            item: {
              select: { gstRate: true }
            }
          }
        },
        table: { select: { label: true } },
        customer: { select: { name: true, phone: true } }
      },
      orderBy: { placedAt: 'desc' },
      take: 50,
    })
  ]);

  const tableFloors = readTableFloors(outlet.settings);
  const tableDtos: TableDto[] = tables.map((t) => ({
    id: t.id,
    label: t.label,
    seats: t.seats,
    state: t.state,
    floorId: tableFloors[t.id] ?? null
  }));

  const gst = readGstConfig(outlet.settings);
  const receipt = readReceiptConfig(outlet.settings);
  const upiConfig = readUpiConfig(outlet.settings, outlet.name);
  const kitchenWorkflow = readKitchenWorkflow(outlet.settings);

  // Serialize all Prisma Date and Decimal objects to plain JSON types for React Server Component boundary safety
  const initialOrders = initialOrdersRaw.map((o) => ({
    id: o.id,
    clientUuid: o.clientUuid,
    number: o.number,
    outletId: o.outletId,
    tableId: o.tableId,
    customerId: o.customerId,
    staffId: o.staffId,
    type: o.type,
    status: o.status,
    channel: o.channel,
    subtotalPaise: o.subtotalPaise,
    discountPaise: o.discountPaise,
    cgstPaise: o.cgstPaise,
    sgstPaise: o.sgstPaise,
    igstPaise: o.igstPaise,
    totalPaise: o.totalPaise,
    placedAt: o.placedAt ? o.placedAt.toISOString() : new Date().toISOString(),
    settledAt: o.settledAt ? o.settledAt.toISOString() : null,
    table: o.table ? { label: o.table.label } : null,
    customer: o.customer ? { name: o.customer.name, phone: o.customer.phone } : null,
    items: o.items.map((i) => ({
      id: i.id,
      orderId: i.orderId,
      itemId: i.itemId,
      nameSnapshot: i.nameSnapshot,
      qty: i.qty,
      unitPricePaise: i.unitPricePaise,
      modifiers: i.modifiers ? JSON.parse(JSON.stringify(i.modifiers)) : null,
      notes: i.notes,
      station: i.station,
      kotStatus: i.kotStatus,
      item: i.item
        ? {
            gstRate: i.item.gstRate != null ? Number(i.item.gstRate) : 5.0,
          }
        : null,
    })),
  }));

  return (
    <TBillingClient
      outlet={{
        id: outlet.id,
        name: outlet.name,
        gstin: outlet.gstin,
        stateCode: outlet.stateCode ?? 'KA',
        gstEnabled: gst.enabled,
        gstRate: gst.calculationMethod === 'flat' && gst.defaultRate != null ? Number(gst.defaultRate) : null,
        gstInclusive: gst.inclusive,
        address: outlet.address,
        timezone: outlet.timezone,
        receipt: JSON.parse(JSON.stringify(receipt)),
        upiConfig: JSON.parse(JSON.stringify(upiConfig)),
        kitchenWorkflow: JSON.parse(JSON.stringify(kitchenWorkflow)),
        gstConfig: JSON.parse(JSON.stringify(gst)),
      }}
      staff={{
        id: session.staffId,
        name: session.name,
        role: session.role,
        roles: session.roles,
        permissions: session.permissions,
        effectivePermissions: session.effectivePermissions,
      }}
      tables={tableDtos}
      initialOrders={initialOrders}
    />
  );
}
