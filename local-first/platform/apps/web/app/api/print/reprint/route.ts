import { NextRequest, NextResponse } from 'next/server';
import { prisma, PrintJobType } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { createPrintJob, processPrintQueueBatch } from '@/lib/print/manager';
import { readReceiptConfig } from '@/lib/receipt';
import { readUpiConfig } from '@/lib/print/upi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/print/reprint
 * Creates an audit-linked REPRINT job for an existing Order or KOT.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { orderId, type = 'KOT', stationId } = body;

  if (!orderId) {
    return NextResponse.json({ error: 'missing_order_id' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      table: { select: { label: true } },
      customer: { select: { name: true, phone: true } },
    },
  });

  if (!order || order.outletId !== session.outletId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { name: true, gstin: true, address: true, timezone: true, settings: true },
  });

  let payload: any;
  const targetStation = stationId || order.items[0]?.station || 'kitchen';

  if (type === 'RECEIPT') {
    const rConfig = readReceiptConfig(outlet?.settings);
    const upiConfig = readUpiConfig(outlet?.settings, outlet?.name);
    payload = {
      storeName: outlet?.name ?? 'ChayaOne Cafe',
      logoUrl: (outlet?.settings as any)?.logoUrl || null,
      address: outlet?.address ?? null,
      timezone: outlet?.timezone ?? 'Asia/Kolkata',
      header: rConfig.header,
      footer: rConfig.footer,
      phone: rConfig.phone,
      gstin: outlet?.gstin,
      orderNumber: order.number,
      tableLabel: order.table?.label ?? null,
      orderType: order.type,
      customerName: order.customer?.name ?? null,
      customerPhone: order.customer?.phone ?? null,
      placedAt: order.placedAt,
      settledAt: order.settledAt,
      items: order.items.map((i) => ({
        name: i.nameSnapshot,
        qty: i.qty,
        unitPricePaise: i.unitPricePaise,
        totalPaise: i.unitPricePaise * i.qty,
        modifiers: Array.isArray(i.modifiers) ? (i.modifiers as { name: string; pricePaise?: number }[]) : [],
        notes: i.notes ?? null,
      })),
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      cgstPaise: order.cgstPaise,
      sgstPaise: order.sgstPaise,
      igstPaise: order.igstPaise,
      roundOffPaise: order.roundOffPaise,
      totalPaise: order.totalPaise,
      isReprint: true,
      isCancelled: order.status === 'cancelled',
      receiptConfig: rConfig,
      upiConfig,
    };
  } else {
    // KOT reprint
    payload = {
      kotNumber: order.number,
      orderNumber: order.number,
      tableLabel: order.table?.label ?? null,
      orderType: order.type,
      stationName: targetStation,
      isReprint: true,
      placedAt: order.placedAt,
      items: order.items
        .filter((i) => !stationId || i.station === stationId || (!i.station && stationId === 'kitchen'))
        .map((i) => ({
          name: i.nameSnapshot,
          qty: i.qty,
          notes: i.notes ?? null,
          modifiers: Array.isArray(i.modifiers) ? (i.modifiers as { name: string }[]) : [],
        })),
    };
  }

  const job = await prisma.$transaction(async (tx) => {
    const created = await createPrintJob(tx, {
      tenantId: session.tenantId,
      outletId: session.outletId,
      orderId: order.id,
      stationId: targetStation,
      jobType: PrintJobType.REPRINT,
      payload,
    });

    await tx.auditLog.create({
      data: {
        outletId: session.outletId,
        actorId: session.staffId,
        action: 'order.reprinted',
        entity: 'order',
        entityId: order.id,
        after: { type, stationId: targetStation, jobId: created.id },
      },
    });

    return created;
  });

  // Trigger processing asynchronously
  processPrintQueueBatch().catch(() => {});

  return NextResponse.json({ ok: true, jobId: job.id, job });
}
