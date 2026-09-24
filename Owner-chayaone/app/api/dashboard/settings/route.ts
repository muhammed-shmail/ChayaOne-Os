import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { readKitchens, kitchenSlug, KITCHEN_NAME_MAX, KITCHEN_PALETTE, type Kitchen } from '@/lib/kitchens';
import { readKitchenWorkflow, normalizeKitchenWorkflowInput } from '@/lib/kitchenWorkflow';
import { readDevices, normalizeDefaults, type Device } from '@/lib/devices';
import { readReceiptConfig, RECEIPT_FIELD_MAX } from '@/lib/receipt';
import { readUpiConfig } from '@/lib/print/upi';
import { normalizeLocationInput } from '@/lib/geo';

import { readDevices, normalizeDefaults, type Device } from '@/lib/devices';
import { printerHealthCheck, checkAllPrintersHealth } from '@/lib/print/health';
import crypto from 'crypto';

const TYPE_VALUES = ['receipt_printer', 'kot_printer', 'both_printer', 'label_printer', 'cash_drawer', 'display', 'other'];
const CONN_VALUES = ['network', 'usb', 'bluetooth'];

async function saveDevices(outletId: string, devices: Device[]) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
  const merged = { ...((outlet?.settings as Record<string, unknown>) ?? {}), devices };
  await prisma.outlet.update({ where: { id: outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPE_VALUES = ['receipt_printer', 'kot_printer', 'both_printer', 'label_printer', 'cash_drawer', 'display', 'other'];
const CONN_VALUES = ['network', 'usb', 'bluetooth'];

async function saveDevices(outletId: string, devices: Device[]) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
  const merged = { ...((outlet?.settings as Record<string, unknown>) ?? {}), devices };
  await prisma.outlet.update({ where: { id: outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager' && session.role !== 'accountant') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let outletId = session.outletId;
  if (!outletId) {
    const firstOutlet = await prisma.outlet.findFirst({
      where: { tenantId: session.tenantId },
      select: { id: true },
    });
    outletId = firstOutlet?.id ?? null;
  }
  if (!outletId) return NextResponse.json({ error: 'no_outlet' }, { status: 400 });

  const body = await req.json().catch(() => ({}));

<<<<<<< Updated upstream
  // ---- Hardware & Printers ----
  if (body.action === 'device_save') {
    const d = body.device ?? {};
    const name = String(d.name ?? '').trim().slice(0, 40);
=======
  // ---- device registry & printer actions ----
  if (body.action === 'device_save') {
    const d = body.device ?? {};
    const name = String(d.name ?? '').trim();
>>>>>>> Stashed changes
    if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
    const type = TYPE_VALUES.includes(d.type) ? d.type : 'receipt_printer';
    const connection = CONN_VALUES.includes(d.connection) ? d.connection : 'network';
    const copies = Number(d.copies);
<<<<<<< Updated upstream
    const ip = typeof d.ip === 'string' && d.ip ? d.ip.trim() : String(d.target ?? '').split(':')[0]?.trim() || '';
    const port = d.port ? String(d.port).trim() : (String(d.target ?? '').split(':')[1] || '9100');
    const target = String(d.target ?? '').trim() || (ip ? `${ip}:${port}` : '');
=======

    let rawIp = typeof d.ip === 'string' && d.ip ? d.ip.trim() : '';
    let rawPort = d.port !== undefined && d.port !== null ? String(d.port).trim() : '';
    let rawTarget = String(d.target ?? '').trim();

    if (rawIp.includes(':')) {
      const parts = rawIp.split(':');
      rawIp = parts[0]?.trim() || '';
      if (!rawPort && parts[1]) rawPort = parts[1].trim();
    }
    if (!rawIp && rawTarget) {
      const parts = rawTarget.split(':');
      rawIp = parts[0]?.trim() || '';
      if (!rawPort && parts[1]) rawPort = parts[1].trim();
    }

    const portNum = parseInt(rawPort || '9100', 10);
    const validPort = !isNaN(portNum) && portNum >= 1 && portNum <= 65535 ? String(portNum) : '9100';
    const target = rawIp ? `${rawIp}:${validPort}` : rawTarget;
>>>>>>> Stashed changes
    const priority = d.priority === 'backup' ? 'backup' : 'primary';
    const kotRule = d.kotRule === 'all_items' ? 'all_items' : d.kotRule === 'custom' ? 'custom' : 'station_only';

    const entry: Device = {
      id: typeof d.id === 'string' && d.id ? d.id : crypto.randomUUID(),
      name,
      type,
      connection,
      target,
<<<<<<< Updated upstream
      ip: ip || null,
      port: port || '9100',
=======
      ip: rawIp || null,
      port: validPort,
>>>>>>> Stashed changes
      station: (type === 'kot_printer' || type === 'display') && d.station ? String(d.station).trim() : null,
      priority,
      kotRule,
      copies: Number.isFinite(copies) && copies >= 1 ? Math.min(5, Math.round(copies)) : 1,
      isDefault: !!d.isDefault,
<<<<<<< Updated upstream
    };

=======
      lastKnownStatus: typeof d.lastKnownStatus === 'string' ? d.lastKnownStatus : undefined,
      lastCheckedAt: typeof d.lastCheckedAt === 'string' ? d.lastCheckedAt : null,
      lastLatencyMs: typeof d.lastLatencyMs === 'number' ? d.lastLatencyMs : null,
      lastError: typeof d.lastError === 'string' ? d.lastError : null,
    };

    console.log('[PRINTER:API:OWNER] Saving device registry entry', { id: entry.id, name: entry.name, target: entry.target });
>>>>>>> Stashed changes
    const current = readDevices((await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } }))?.settings);
    const idx = current.findIndex((x) => x.id === entry.id);
    if (idx >= 0) current[idx] = entry; else current.push(entry);

    if (entry.type === 'kot_printer' && entry.station && entry.priority === 'primary') {
      current.forEach((p) => {
        if (p.id !== entry.id && p.type === 'kot_printer' && p.station === entry.station && p.priority === 'primary') {
          p.priority = 'backup';
        }
      });
    }

    const next = normalizeDefaults(current, entry.isDefault ? entry.id : undefined);
    await saveDevices(outletId, next);
    return NextResponse.json({ ok: true, devices: next });
  }

  if (body.action === 'device_delete') {
    if (!body.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    const current = readDevices((await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } }))?.settings);
    const next = current.filter((x) => x.id !== body.id);
    await saveDevices(outletId, next);
    return NextResponse.json({ ok: true, devices: next });
  }

<<<<<<< Updated upstream
  // ---- kitchens / prep stations (stored in Outlet.settings.kitchens) ----
  if (body.action === 'kitchen_add' || body.action === 'kitchen_rename' || body.action === 'kitchen_delete') {
    const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
    const settings = (outlet?.settings as Record<string, unknown>) ?? {};
    const current = readKitchens(settings);
    let next: Kitchen[];

    if (body.action === 'kitchen_add') {
      const name = String(body.name ?? '').trim().slice(0, KITCHEN_NAME_MAX);
      if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
      if (current.some((k) => k.name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: 'duplicate_name' }, { status: 409 });
      let id = kitchenSlug(name) || 'kitchen';
      if (current.some((k) => k.id === id)) { let n = 2; while (current.some((k) => k.id === `${id}-${n}`)) n++; id = `${id}-${n}`; }
      const color = KITCHEN_PALETTE[current.length % KITCHEN_PALETTE.length];
      next = [...current, { id, name, color, sort: current.length }];
    } else if (body.action === 'kitchen_rename') {
      const id = String(body.id ?? '');
      const name = String(body.name ?? '').trim().slice(0, KITCHEN_NAME_MAX);
      if (!id || !name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
      if (current.some((k) => k.id !== id && k.name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: 'duplicate_name' }, { status: 409 });
      if (!current.some((k) => k.id === id)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      next = current.map((k) => (k.id === id ? { ...k, name } : k));
    } else {
      const id = String(body.id ?? '');
      if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
      if (current.length <= 1) return NextResponse.json({ error: 'last_kitchen' }, { status: 409 });
      next = current.filter((k) => k.id !== id).map((k, i) => ({ ...k, sort: i }));
    }

    const merged = { ...settings, kitchens: next };
    await prisma.outlet.update({ where: { id: outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    await prisma.auditLog.create({
      data: { outletId, actorId: session.staffId, action: `kitchen.${body.action.replace('kitchen_', '')}`, entity: 'outlet', entityId: outletId, after: { kitchens: next } as unknown as Prisma.InputJsonValue },
    }).catch(() => {});
    return NextResponse.json({ ok: true, kitchens: next });
  }

  // ---- receipt layout ----
  if (body.action === 'receipt') {
    const r = (body.receipt ?? {}) as Record<string, unknown>;
    const clean = (v: unknown) => String(v ?? '').slice(0, RECEIPT_FIELD_MAX);
    const receipt = {
      header: clean(r.header),
      footer: clean(r.footer),
      phone: clean(r.phone),
      showLogo: r.showLogo !== false,
      showAddress: r.showAddress !== false,
      showPhone: r.showPhone !== false,
      showGstin: r.showGstin !== false,
      showTableNumber: r.showTableNumber !== false,
      showOrderNumber: r.showOrderNumber !== false,
      showDateTime: r.showDateTime !== false,
      showItemNotes: !!r.showItemNotes,
      showTaxDetails: r.showTaxDetails !== false,
      showDiscount: r.showDiscount !== false,
      showUpiQr: r.showUpiQr !== false,
      showScanAndPay: r.showScanAndPay !== false,
      paperWidth: r.paperWidth === '58mm' ? '58mm' : '80mm',
      qrSize: r.qrSize === 'small' || r.qrSize === 'large' ? r.qrSize : 'medium',
    };
    const current = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    const merged = { ...settings, receipt };
    await prisma.outlet.update({ where: { id: outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    return NextResponse.json({ ok: true, receipt: readReceiptConfig(merged) });
  }

  // ---- payment / UPI settings ----
  if (body.action === 'payment') {
    const p = (body.payment ?? {}) as Record<string, unknown>;
    const current = await prisma.outlet.findUnique({ where: { id: outletId }, select: { name: true, settings: true } });
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    const existingPayment = (settings.payment as Record<string, unknown> | undefined) ?? {};

    const updatedPayment = {
      ...existingPayment,
      upiEnabled: p.upiEnabled !== undefined ? !!p.upiEnabled : existingPayment.upiEnabled ?? true,
      upiId: typeof p.upiId === 'string' ? p.upiId.trim() : existingPayment.upiId ?? '',
      upiBusinessName: typeof p.upiBusinessName === 'string' ? p.upiBusinessName.trim() : (existingPayment.upiBusinessName ?? current?.name ?? 'Chaya Cafe'),
      receiptQrEnabled: p.receiptQrEnabled !== undefined ? !!p.receiptQrEnabled : existingPayment.receiptQrEnabled ?? true,
      receiptQrSize: p.receiptQrSize === 'small' || p.receiptQrSize === 'large' ? p.receiptQrSize : 'medium',
      showScanAndPayText: p.showScanAndPayText !== undefined ? !!p.showScanAndPayText : existingPayment.showScanAndPayText ?? true,
      cashEnabled: p.cashEnabled !== undefined ? !!p.cashEnabled : existingPayment.cashEnabled ?? true,
      cardEnabled: p.cardEnabled !== undefined ? !!p.cardEnabled : existingPayment.cardEnabled ?? true,
    };

    const merged = { ...settings, payment: updatedPayment };
    await prisma.outlet.update({ where: { id: outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    return NextResponse.json({ ok: true, payment: readUpiConfig(merged, current?.name) });
  }

  // ---- kitchen workflow ----
  if (body.action === 'kitchen_workflow') {
    const kitchenWorkflow = normalizeKitchenWorkflowInput(body.workflow ?? {});
    const current = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    const merged = { ...settings, kitchenWorkflow };
    await prisma.outlet.update({ where: { id: outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    return NextResponse.json({ ok: true, kitchenWorkflow: readKitchenWorkflow(merged) });
  }

  // ---- location gate ----
  if (body.action === 'location') {
    if (session.role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const location = normalizeLocationInput(body.location);
    const current = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    const merged = { ...settings, location };
    await prisma.outlet.update({ where: { id: outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    return NextResponse.json({ ok: true, location });
=======
  if (body.action === 'device_test_connection') {
    const rawTarget = String(body.target || '').trim();
    const rawIp = String(body.ip || body.host || '').trim();
    const rawPort = body.port !== undefined ? body.port : undefined;
    const printerId = body.id || body.printerId || null;
    const name = body.name || 'Printer';

    console.log('[PRINTER:API:OWNER] Received printer test request', { printerId, name, ip: rawIp, port: rawPort, target: rawTarget });
    const result = await printerHealthCheck({
      host: rawIp,
      port: rawPort,
      target: rawTarget,
      printerId,
      name,
      timeoutMs: 2500,
    });

    if (result.printerId) {
      try {
        const current = readDevices((await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } }))?.settings);
        const idx = current.findIndex((x) => x.id === result.printerId);
        const targetDev = current[idx];
        if (targetDev) {
          targetDev.lastKnownStatus = result.status;
          targetDev.lastCheckedAt = result.checkedAt;
          targetDev.lastLatencyMs = result.latencyMs;
          targetDev.lastError = result.errorCode;
          await saveDevices(outletId, current);
        }
      } catch (err) {
        console.warn('[PRINTER:API:OWNER] Could not persist device lastKnownStatus:', err);
      }
    }

    return NextResponse.json({
      ok: true,
      reachable: result.success,
      ...result,
    });
  }

  if (body.action === 'device_health_check_all') {
    console.log('[PRINTER:API:OWNER] Received batch health check request');
    const current = readDevices((await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } }))?.settings);
    const results = await checkAllPrintersHealth(current);

    let changed = false;
    for (const r of results) {
      if (r.printerId) {
        const dev = current.find((d) => d.id === r.printerId);
        if (dev) {
          dev.lastKnownStatus = r.status;
          dev.lastCheckedAt = r.checkedAt;
          dev.lastLatencyMs = r.latencyMs;
          dev.lastError = r.errorCode;
          changed = true;
        }
      }
    }
    if (changed) {
      await saveDevices(outletId, current).catch(() => {});
    }

    return NextResponse.json({ ok: true, devices: current, results });
>>>>>>> Stashed changes
  }

  if (body.action !== 'outlet') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  if (typeof body.logoUrl === 'string' && body.logoUrl.startsWith('blob:')) {
    return NextResponse.json(
      { error: 'invalid_logo_url', message: 'Temporary blob URLs cannot be persisted.' },
      { status: 400 }
    );
  }

  const data: Prisma.OutletUpdateInput = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (body.gstin !== undefined) data.gstin = body.gstin ? String(body.gstin).trim() : null;
  if (body.stateCode !== undefined) data.stateCode = body.stateCode ? String(body.stateCode).trim().toUpperCase().slice(0, 2) : null;
  if (body.address && typeof body.address === 'object') {
    data.address = {
      line1: String(body.address.line1 ?? '').trim(),
      city: String(body.address.city ?? '').trim(),
      pincode: String(body.address.pincode ?? '').trim(),
    } as Prisma.InputJsonValue;
  }

  if (body.gstEnabled !== undefined || body.gstRate !== undefined || body.gstType !== undefined || body.logoUrl !== undefined) {
    const current = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    if (body.gstEnabled !== undefined || body.gstRate !== undefined || body.gstType !== undefined) {
      const gst = (settings.gst as Record<string, unknown>) ?? {};
      if (body.gstEnabled !== undefined) gst.enabled = !!body.gstEnabled;
      if (body.gstRate !== undefined) {
        const rate = Number(body.gstRate);
        gst.rate = Number.isFinite(rate) && rate > 0 ? Math.min(28, Math.round(rate * 100) / 100) : null;
      }
      if (body.gstType !== undefined) gst.type = body.gstType === 'inclusive' ? 'inclusive' : 'exclusive';
      settings.gst = gst;
    }
    if (body.logoUrl !== undefined) {
      const cleanLogoUrl = body.logoUrl ? String(body.logoUrl).trim().slice(0, 1000) : null;
      settings.logoUrl = cleanLogoUrl;

      // Sync to TenantBranding so tenant-level brand fallback receives the logo
      await prisma.tenantBranding.upsert({
        where: { tenantId: session.tenantId },
        create: { tenantId: session.tenantId, logoUrl: cleanLogoUrl },
        update: { logoUrl: cleanLogoUrl },
      }).catch((err) => console.warn('[Owner settings] TenantBranding sync error:', err));
    }
    data.settings = settings as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });

  const outlet = await prisma.outlet.update({
    where: { id: outletId },
    data,
    select: { name: true, gstin: true, stateCode: true, address: true, timezone: true, settings: true },
  });

  const updatedLogoUrl = (outlet.settings as any)?.logoUrl || null;

  await prisma.auditLog.create({
    data: {
      outletId,
      actorId: session.staffId,
      action: 'outlet.updated',
      entity: 'outlet',
      entityId: outletId,
      after: data as Prisma.InputJsonValue,
    },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    outlet: {
      ...outlet,
      logoUrl: updatedLogoUrl,
    },
  });
}
