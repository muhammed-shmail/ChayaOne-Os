import { NextRequest, NextResponse } from 'next/server';
import net from 'net';
import { prisma, PrintJobType, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { hasRole, hasPermission } from '@/lib/rbac';
import { readDevices, normalizeDefaults, type Device } from '@/lib/devices';
import { readReceiptConfig, RECEIPT_FIELD_MAX } from '@/lib/receipt';
import { readUpiConfig } from '@/lib/print/upi';
import { normalizeLocationInput } from '@/lib/geo';
import { readKitchens, kitchenSlug, KITCHEN_NAME_MAX, KITCHEN_PALETTE, type Kitchen } from '@/lib/kitchens';
import { readKitchenWorkflow, normalizeKitchenWorkflowInput } from '@/lib/kitchenWorkflow';
import { createPrintJob, processPrintQueueBatch } from '@/lib/print/manager';
import { printerHealthCheck, checkAllPrintersHealth, parsePrinterEndpoint } from '@/lib/print/health';
import { getModuleStatePayload, setModuleConfig, getModuleConfig } from '@/lib/modules';
import { publishLocalRealtimeEvent } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPE_VALUES = ['receipt_printer', 'kot_printer', 'both_printer', 'label_printer', 'cash_drawer', 'display', 'other'];
const CONN_VALUES = ['network', 'usb', 'bluetooth'];

/** persist the device list back into Outlet.settings.devices (merged). */
async function saveDevices(outletId: string, devices: Device[]) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
  const merged = { ...((outlet?.settings as Record<string, unknown>) ?? {}), devices };
  await prisma.outlet.update({ where: { id: outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
}

/**
 * POST /api/dashboard/settings — update the outlet's store profile or device registry.
 *   { action: 'outlet', name?, gstin?, stateCode?, address? }
 *   { action: 'device_save', device: { id?, name, type, connection, target?, station?, copies?, isDefault? } }
 *   { action: 'device_remove', id }
 *   { action: 'printer_test', ip, port? }  (cashier allowed — they test their own receipt slip)
 *   { action: 'pos_print_now', printJobId }
 *   { action: 'receipt', receipt: ReceiptConfig }
 *   { action: 'location', enabled, lat, lng, radiusMeters, gateAttendance, gatePosOrders }
 * Owner/manager/accountant only (printer_test also allows cashier).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasRole(session, ['owner', 'manager', 'accountant']) && !hasPermission(session, 'settings:general')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // ---- Module Management & Business Profile ----
  if (body.action === 'modules_get') {
    const payload = await getModuleStatePayload(session.outletId);
    return NextResponse.json({ ok: true, ...payload });
  }

  if (body.action === 'modules_update') {
    if (!hasRole(session, ['owner', 'manager']) && !hasPermission(session, 'settings:general')) {
      return NextResponse.json({ error: 'forbidden', message: 'Only store owners or managers can modify modules.' }, { status: 403 });
    }
    try {
      const updated = await setModuleConfig(session.outletId, {
        businessType: body.businessType,
        enabledModules: body.enabledModules,
        moduleSettings: body.moduleSettings,
      });
      return NextResponse.json({ ok: true, config: updated });
    } catch (err: any) {
      return NextResponse.json({ error: 'failed_to_update_modules', message: err.message }, { status: 400 });
    }
  }

  // ---- Advanced GST Settings Saving & Resets ----
  if (body.action === 'gst_save') {
    const inputGst = body.gst ?? {};
    const enabled = !!inputGst.enabled;
    const gstin = String(inputGst.gstin ?? '').trim().toUpperCase();
    const legalName = String(inputGst.legalName ?? '').trim();
    const stateCode = String(inputGst.stateCode ?? '').trim().toUpperCase().slice(0, 2);
    const registrationType = inputGst.registrationType === 'composition' ? 'composition' : 'regular';
    const gstType = inputGst.gstType === 'inclusive' ? 'inclusive' : 'exclusive';
    const calculationMethod = inputGst.calculationMethod === 'flat' ? 'flat' : 'per_item';
    const defaultRate = Number(inputGst.defaultRate ?? 5);
    const reason = String(body.reason ?? 'GST Settings Updated').trim();

    if (enabled) {
      if (!gstin) return NextResponse.json({ error: 'missing_gstin', message: 'GSTIN is required when GST is enabled.' }, { status: 400 });
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
      if (!gstinRegex.test(gstin)) {
        return NextResponse.json({ error: 'invalid_gstin', message: 'GSTIN format is invalid.' }, { status: 400 });
      }
      if (!legalName) return NextResponse.json({ error: 'missing_legal_name', message: 'Legal Business Name is required.' }, { status: 400 });
      if (!stateCode) return NextResponse.json({ error: 'missing_state_code', message: 'State code is required.' }, { status: 400 });
    }

    const currentOutlet = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true, gstin: true, stateCode: true } });
    const settings = (currentOutlet?.settings as Record<string, unknown>) ?? {};
    
    // Save previous GST for audit
    const prevGst = settings.gst ?? {};

    // Check duplicate GSTIN across other outlets (excluding this one)
    if (enabled && gstin) {
      const duplicate = await prisma.outlet.findFirst({
        where: { gstin, id: { not: session.outletId } },
        select: { id: true, name: true }
      });
      if (duplicate) {
        return NextResponse.json({ error: 'duplicate_gstin', message: `GSTIN is already registered to outlet: ${duplicate.name}` }, { status: 400 });
      }
    }

    const nextGst = {
      ...prevGst,
      enabled,
      // Preserve gstin/legalName/stateCode when disabling so they can be restored
      // on re-enable without the user needing to re-enter them. Only gst_reset clears.
      gstin: enabled ? gstin : (String((prevGst as any).gstin ?? '')),
      legalName: enabled ? legalName : (String((prevGst as any).legalName ?? '')),
      stateCode: enabled ? stateCode : (String((prevGst as any).stateCode ?? '')),
      registrationType,
      gstType,
      calculationMethod,
      defaultRate: Number.isFinite(defaultRate) ? defaultRate : 5,
      
      // Rules
      gstOnFood: inputGst.gstOnFood === undefined ? true : !!inputGst.gstOnFood,
      gstOnBeverage: inputGst.gstOnBeverage === undefined ? true : !!inputGst.gstOnBeverage,
      gstOnCombo: inputGst.gstOnCombo === undefined ? true : !!inputGst.gstOnCombo,
      gstOnDelivery: !!inputGst.gstOnDelivery,
      gstOnPackaging: !!inputGst.gstOnPackaging,
      gstOnServiceCharge: !!inputGst.gstOnServiceCharge,
      gstOnConvenience: !!inputGst.gstOnConvenience,
      chargeGstRate: typeof inputGst.chargeGstRate === 'number' ? inputGst.chargeGstRate : 5,

      // Discount rules
      calculateGstBeforeDiscount: !!inputGst.calculateGstBeforeDiscount,
      applyGstToCoupon: inputGst.applyGstToCoupon === undefined ? true : !!inputGst.applyGstToCoupon,
      applyGstToManual: inputGst.applyGstToManual === undefined ? true : !!inputGst.applyGstToManual,

      // Specific overrides
      dineInRate: typeof inputGst.dineInRate === 'number' ? inputGst.dineInRate : null,
      takeawayRate: typeof inputGst.takeawayRate === 'number' ? inputGst.takeawayRate : null,
      deliveryRate: typeof inputGst.deliveryRate === 'number' ? inputGst.deliveryRate : null,
      qrOrderingRate: typeof inputGst.qrOrderingRate === 'number' ? inputGst.qrOrderingRate : null,
      cloudKitchenRate: typeof inputGst.cloudKitchenRate === 'number' ? inputGst.cloudKitchenRate : null,

      // Receipt settings
      showGstin: inputGst.showGstin === undefined ? true : !!inputGst.showGstin,
      showTaxSummary: inputGst.showTaxSummary === undefined ? true : !!inputGst.showTaxSummary,
      showCgst: inputGst.showCgst === undefined ? true : !!inputGst.showCgst,
      showSgst: inputGst.showSgst === undefined ? true : !!inputGst.showSgst,
      showIgst: inputGst.showIgst === undefined ? true : !!inputGst.showIgst,
      showHsn: inputGst.showHsn === undefined ? true : !!inputGst.showHsn,
      showTaxPct: inputGst.showTaxPct === undefined ? true : !!inputGst.showTaxPct,
      showTaxAmt: inputGst.showTaxAmt === undefined ? true : !!inputGst.showTaxAmt,
      receiptFooter: typeof inputGst.receiptFooter === 'string' ? inputGst.receiptFooter : 'Thank you! Visit again.',
      taxInvoiceTitle: typeof inputGst.taxInvoiceTitle === 'string' ? inputGst.taxInvoiceTitle : 'TAX INVOICE',

      // Invoice Settings
      invoicePrefix: typeof inputGst.invoicePrefix === 'string' ? inputGst.invoicePrefix : 'CHY',
      invoiceFormat: typeof inputGst.invoiceFormat === 'string' ? inputGst.invoiceFormat : 'YYYY/MM/DD/NNNN',
      roundOff: inputGst.roundOff === undefined ? true : !!inputGst.roundOff,
      roundingPrecision: typeof inputGst.roundingPrecision === 'number' ? inputGst.roundingPrecision : 0,
      printTaxInvoice: inputGst.printTaxInvoice === undefined ? true : !!inputGst.printTaxInvoice,
      duplicateInvoice: inputGst.duplicateInvoice === undefined ? true : !!inputGst.duplicateInvoice,
    };

    settings.gst = nextGst;

    const userAgent = req.headers.get('user-agent') ?? 'Unknown Device';
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
    const staff = await prisma.staffUser.findUnique({ where: { id: session.staffId }, select: { name: true } });

    await prisma.$transaction([
      prisma.outlet.update({
        where: { id: session.outletId },
        data: {
          // Keep outlet-level gstin/stateCode columns even when GST is disabled:
          // POS receipt, T-billing, and state-routing logic read these columns
          // independently of the GST enabled flag. Only clear on gst_reset.
          gstin: enabled ? gstin : (currentOutlet?.gstin ?? null),
          stateCode: enabled ? stateCode : (currentOutlet?.stateCode ?? null),
          settings: settings as Prisma.InputJsonValue,
        }
      }),
      prisma.auditLog.create({
        data: {
          outletId: session.outletId,
          actorId: session.staffId,
          action: 'gst.updated',
          entity: 'gst_config',
          entityId: session.outletId,
          before: { gst: prevGst } as Prisma.InputJsonValue,
          after: {
            gst: nextGst,
            audit: {
              user: staff?.name ?? 'Unknown',
              ip,
              device: userAgent,
              reason
            }
          } as Prisma.InputJsonValue
        }
      })
    ]);

    return NextResponse.json({ ok: true, gst: nextGst });
  }

  if (body.action === 'gst_reset') {
    const currentOutlet = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } });
    const settings = (currentOutlet?.settings as Record<string, unknown>) ?? {};
    const prevGst = settings.gst ?? {};
    
    settings.gst = {
      enabled: false,
      gstin: '',
      legalName: '',
      stateCode: '',
      registrationType: 'regular',
      gstType: 'exclusive',
      inclusive: false,
      calculationMethod: 'per_item',
      defaultRate: 5,
    };

    const userAgent = req.headers.get('user-agent') ?? 'Unknown Device';
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const staff = await prisma.staffUser.findUnique({ where: { id: session.staffId }, select: { name: true } });

    await prisma.$transaction([
      prisma.outlet.update({
        where: { id: session.outletId },
        data: {
          gstin: null,
          stateCode: null,
          settings: settings as Prisma.InputJsonValue,
        }
      }),
      prisma.auditLog.create({
        data: {
          outletId: session.outletId,
          actorId: session.staffId,
          action: 'gst.reset',
          entity: 'gst_config',
          entityId: session.outletId,
          before: { gst: prevGst } as Prisma.InputJsonValue,
          after: {
            gst: settings.gst,
            audit: {
              user: staff?.name ?? 'Unknown',
              ip,
              device: userAgent,
              reason: 'Restored default settings'
            }
          } as Prisma.InputJsonValue
        }
      })
    ]);

    return NextResponse.json({ ok: true, gst: settings.gst });
  }

  // ---- device registry (stored in Outlet.settings.devices) ----
  if (body.action === 'device_save') {
    const d = body.device ?? {};
    const name = String(d.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
    const type = TYPE_VALUES.includes(d.type) ? d.type : 'receipt_printer';
    const connection = CONN_VALUES.includes(d.connection) ? d.connection : 'network';
    const copies = Number(d.copies);

    // Robust parsing of IP and Port
    let rawIp = typeof d.ip === 'string' && d.ip ? d.ip.trim() : '';
    let rawPort = d.port !== undefined && d.port !== null ? String(d.port).trim() : '';
    let rawTarget = String(d.target ?? '').trim();

    // If IP contains a port delimiter (e.g. user entered 192.168.220.53:9100 in the IP box)
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
    const priority = d.priority === 'backup' ? 'backup' : 'primary';
    const kotRule = d.kotRule === 'all_items' ? 'all_items' : d.kotRule === 'custom' ? 'custom' : 'station_only';

    const entry: Device = {
      id: typeof d.id === 'string' && d.id ? d.id : crypto.randomUUID(),
      name,
      type,
      connection,
      target,
      ip: rawIp || null,
      port: validPort,
      station: (type === 'kot_printer' || type === 'display') && d.station ? String(d.station).trim() : null,
      priority,
      kotRule,
      copies: Number.isFinite(copies) && copies >= 1 ? Math.min(5, Math.round(copies)) : 1,
      isDefault: !!d.isDefault,
      lastKnownStatus: typeof d.lastKnownStatus === 'string' ? d.lastKnownStatus : undefined,
      lastCheckedAt: typeof d.lastCheckedAt === 'string' ? d.lastCheckedAt : null,
      lastLatencyMs: typeof d.lastLatencyMs === 'number' ? d.lastLatencyMs : null,
      lastError: typeof d.lastError === 'string' ? d.lastError : null,
    };

    console.log('[PRINTER:API] Saving device registry entry', {
      id: entry.id,
      name: entry.name,
      target: entry.target,
      ip: entry.ip,
      port: entry.port,
      connection: entry.connection,
      station: entry.station,
    });

    const current = readDevices((await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } }))?.settings);
    const idx = current.findIndex((x) => x.id === entry.id);
    if (idx >= 0) current[idx] = entry; else current.push(entry);

    // If marked as primary for a station, update other printers for the same station to backup
    if (entry.type === 'kot_printer' && entry.station && entry.priority === 'primary') {
      current.forEach((p) => {
        if (p.id !== entry.id && p.type === 'kot_printer' && p.station === entry.station && p.priority === 'primary') {
          p.priority = 'backup';
        }
      });
    }

    const next = normalizeDefaults(current, entry.isDefault ? entry.id : undefined);
    await saveDevices(session.outletId, next);
    await prisma.auditLog.create({
      data: { outletId: session.outletId, actorId: session.staffId, action: 'device.saved', entity: 'device', entityId: entry.id, after: entry as unknown as Prisma.InputJsonValue },
    }).catch(() => {});
    return NextResponse.json({ ok: true, devices: next });
  }

  if (body.action === 'device_delete') {
    if (!body.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    const current = readDevices((await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } }))?.settings);
    const next = current.filter((x) => x.id !== body.id);
    await saveDevices(session.outletId, next);
    return NextResponse.json({ ok: true, devices: next });
  }

  if (body.action === 'device_test_connection') {
    const rawTarget = String(body.target || '').trim();
    const rawIp = String(body.ip || body.host || '').trim();
    const rawPort = body.port !== undefined ? body.port : undefined;
    const printerId = body.id || body.printerId || null;
    const name = body.name || 'Printer';

    console.log('[PRINTER:API] Received printer test request', {
      printerId,
      name,
      ip: rawIp,
      port: rawPort,
      target: rawTarget,
    });

    const result = await printerHealthCheck({
      host: rawIp,
      port: rawPort,
      target: rawTarget,
      printerId,
      name,
      timeoutMs: 2500,
    });

    console.log('[PRINTER:API] Responding to test request', {
      status: result.status,
      reachable: result.success,
      latencyMs: result.latencyMs,
      errorCode: result.errorCode,
    });

    // Optionally update device's lastKnownStatus in database if registered printerId is supplied
    if (result.printerId) {
      try {
        const current = readDevices((await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } }))?.settings);
        const idx = current.findIndex((x) => x.id === result.printerId);
        const targetDev = current[idx];
        if (targetDev) {
          targetDev.lastKnownStatus = result.status;
          targetDev.lastCheckedAt = result.checkedAt;
          targetDev.lastLatencyMs = result.latencyMs;
          targetDev.lastError = result.errorCode;
          await saveDevices(session.outletId, current);
        }
      } catch (err) {
        console.warn('[PRINTER:API] Could not persist device lastKnownStatus:', err);
      }
    }

    return NextResponse.json({
      ok: true,
      reachable: result.success,
      ...result,
    });
  }

  if (body.action === 'device_health_check_all') {
    console.log('[PRINTER:API] Received batch health check request for outlet', session.outletId);
    const current = readDevices((await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } }))?.settings);
    const results = await checkAllPrintersHealth(current);

    // Persist live statuses back into DB
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
      await saveDevices(session.outletId, current).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      devices: current,
      results,
    });
  }

  if (body.action === 'device_test_kot') {
    const d = body.device ?? {};
    const stationName = String(d.station || body.station || 'kitchen').trim();
    const printerName = String(d.name || body.name || 'Kitchen Printer 01').trim();
    const printerId = typeof d.id === 'string' ? d.id : null;

    console.log('[PRINTER:API] Received Print Test request', {
      printerId,
      printerName,
      stationName,
      target: d.target,
      ip: d.ip,
      port: d.port,
    });

    // 1. Resolve printer target host & port
    const endpoint = parsePrinterEndpoint({
      host: d.ip,
      port: d.port,
      target: d.target,
    });

    // 2. Preflight TCP connection test before queuing print!
    if (endpoint.isValid) {
      const preflight = await printerHealthCheck({
        host: endpoint.host,
        port: endpoint.port,
        printerId,
        name: printerName,
        timeoutMs: 2500,
      });

      if (!preflight.success) {
        console.error('[PRINTER:PRINT_TEST] Preflight check failed! Printer is unreachable:', preflight);
        return NextResponse.json(
          {
            ok: false,
            reachable: false,
            status: preflight.status,
            errorCode: preflight.errorCode,
            message: `Print Test aborted: Printer "${printerName}" is unreachable at ${preflight.host}:${preflight.port} (${preflight.errorMessage || preflight.message})`,
            error: preflight.errorMessage,
          },
          { status: 503 }
        );
      }
      console.log(`[PRINTER:PRINT_TEST] Preflight check passed for ${printerName} (${preflight.latencyMs}ms). Proceeding to print.`);
    }

    const job = await prisma.$transaction(async (tx) => {
      return await createPrintJob(tx, {
        tenantId: session.tenantId,
        outletId: session.outletId,
        printerId,
        stationId: stationName,
        jobType: PrintJobType.KOT,
        payload: {
          kotNumber: Math.floor(1000 + Math.random() * 9000),
          orderNumber: 99,
          tableLabel: 'TEST-01',
          orderType: 'DINE_IN',
          stationName,
          placedAt: new Date(),
          items: [
            { name: `[TEST KOT] ${printerName}`, qty: 1, notes: 'ChayaOne Diagnostic Test Print' }
          ]
        },
        priority: 100,
      });
    });

    const queueRes = await processPrintQueueBatch().catch((err) => {
      console.error('[PRINTER:PRINT_TEST] Error processing print queue batch:', err);
      return { processed: 0, printed: 0, failed: 1 };
    });

    const success = queueRes.printed > 0 || (queueRes.processed > 0 && queueRes.failed === 0);

    return NextResponse.json({
      ok: success,
      reachable: true,
      status: success ? 'ONLINE' : 'ERROR',
      jobId: job.id,
      message: success
        ? `✓ Test KOT successfully printed to ${printerName} (${endpoint.host || 'LAN'}:${endpoint.port || 9100}).`
        : `✕ Test KOT dispatched but print processing failed. Check printer paper and spooler.`,
      queueRes,
    });
  }

  // ---- kitchens / prep stations (stored in Outlet.settings.kitchens) ----
  // Persisting from the defaults on first edit keeps every existing menu item
  // (station = 'kitchen'|'bar'|'dessert') mapped; the slug id is stable so a
  // rename never orphans items.
  if (body.action === 'kitchen_add' || body.action === 'kitchen_rename' || body.action === 'kitchen_delete') {
    const outlet = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } });
    const settings = (outlet?.settings as Record<string, unknown>) ?? {};
    const current = readKitchens(settings);
    let next: Kitchen[];

    if (body.action === 'kitchen_add') {
      const name = String(body.name ?? '').trim().slice(0, KITCHEN_NAME_MAX);
      if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
      if (current.some((k) => k.name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: 'duplicate_name' }, { status: 409 });
      // stable, unique slug id
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
      next = current.map((k) => (k.id === id ? { ...k, name } : k)); // id/slug stays → items stay mapped
    } else {
      const id = String(body.id ?? '');
      if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
      if (current.length <= 1) return NextResponse.json({ error: 'last_kitchen' }, { status: 409 });
      next = current.filter((k) => k.id !== id).map((k, i) => ({ ...k, sort: i }));
    }

    const merged = { ...settings, kitchens: next };
    await prisma.outlet.update({ where: { id: session.outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    await prisma.auditLog.create({
      data: { outletId: session.outletId, actorId: session.staffId, action: `kitchen.${body.action.replace('kitchen_', '')}`, entity: 'outlet', entityId: session.outletId, after: { kitchens: next } as unknown as Prisma.InputJsonValue },
    }).catch(() => {});
    return NextResponse.json({ ok: true, kitchens: next });
  }

  // ---- receipt layout (stored in Outlet.settings.receipt) ----
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
    const current = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } });
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    const merged = { ...settings, receipt };
    await prisma.outlet.update({ where: { id: session.outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    await prisma.auditLog.create({
      data: { outletId: session.outletId, actorId: session.staffId, action: 'receipt.updated', entity: 'outlet', entityId: session.outletId, after: receipt as unknown as Prisma.InputJsonValue },
    }).catch(() => {});
    return NextResponse.json({ ok: true, receipt: readReceiptConfig(merged) });
  }

  // ---- payment / UPI settings (stored in Outlet.settings.payment) ----
  if (body.action === 'payment') {
    const p = (body.payment ?? {}) as Record<string, unknown>;
    const current = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { name: true, settings: true } });
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
    await prisma.outlet.update({ where: { id: session.outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    await prisma.auditLog.create({
      data: { outletId: session.outletId, actorId: session.staffId, action: 'payment.updated', entity: 'outlet', entityId: session.outletId, after: updatedPayment as unknown as Prisma.InputJsonValue },
    }).catch(() => {});
    return NextResponse.json({ ok: true, payment: readUpiConfig(merged, current?.name) });
  }

  // ---- kitchen workflow (stored in Outlet.settings.kitchenWorkflow) ----
  // Digital KDS / Printed KOT / Hybrid + all the KDS display options. The whole
  // config is normalized server-side (readKitchenWorkflow rules), so a bad
  // client value can never break the KDS render.
  if (body.action === 'kitchen_workflow') {
    const kitchenWorkflow = normalizeKitchenWorkflowInput(body.workflow ?? {});
    const current = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } });
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    const merged = { ...settings, kitchenWorkflow };
    await prisma.outlet.update({ where: { id: session.outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    await prisma.auditLog.create({
      data: { outletId: session.outletId, actorId: session.staffId, action: 'kitchen.workflow_updated', entity: 'outlet', entityId: session.outletId, after: kitchenWorkflow as unknown as Prisma.InputJsonValue },
    }).catch(() => {});
    return NextResponse.json({ ok: true, kitchenWorkflow: readKitchenWorkflow(merged) });
  }

  // ---- location gate (stored in Outlet.settings.location) ----
  // Owner-only: only the owner defines the cafe's location, and the owner is the
  // one party exempt from the geofence at enforcement time (lib/geo.ts).
  if (body.action === 'location') {
    if (session.role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const location = normalizeLocationInput(body.location);
    const current = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } });
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    const merged = { ...settings, location };
    await prisma.outlet.update({ where: { id: session.outletId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
    await prisma.auditLog.create({
      data: { outletId: session.outletId, actorId: session.staffId, action: 'outlet.location_updated', entity: 'outlet', entityId: session.outletId, after: location as unknown as Prisma.InputJsonValue },
    }).catch(() => {});
    return NextResponse.json({ ok: true, location });
  }

  if (body.action !== 'outlet') return NextResponse.json({ error: 'invalid_action' }, { status: 400 });

  if (typeof body.logoUrl === 'string' && body.logoUrl.startsWith('blob:')) {
    return NextResponse.json({ error: 'invalid_logo_url', message: 'Temporary blob URLs cannot be persisted.' }, { status: 400 });
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

  // GST config + store logo URL live in Outlet.settings (merged, not columns —
  // keeps existing outlets untouched). Read once, apply both, write once.
  if (body.gstEnabled !== undefined || body.gstRate !== undefined || body.gstType !== undefined || body.logoUrl !== undefined) {
    const current = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { settings: true } });
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
      }).catch((err) => console.warn('[settings] TenantBranding sync error:', err));
    }
    data.settings = settings as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });

  const outlet = await prisma.outlet.update({
    where: { id: session.outletId },
    data,
    select: { name: true, gstin: true, stateCode: true, address: true, timezone: true, settings: true },
  });

  const updatedLogoUrl = (outlet.settings as any)?.logoUrl || null;

  if (body.logoUrl !== undefined) {
    publishLocalRealtimeEvent(session.outletId, {
      type: 'outlet.updated',
      outletId: session.outletId,
      logoUrl: updatedLogoUrl,
    });
  }

  await prisma.auditLog.create({
    data: { outletId: session.outletId, actorId: session.staffId, action: 'outlet.updated', entity: 'outlet', entityId: session.outletId, after: data as Prisma.InputJsonValue },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    outlet: {
      ...outlet,
      logoUrl: updatedLogoUrl,
    },
  });
}
