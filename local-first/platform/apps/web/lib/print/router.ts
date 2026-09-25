import { readDevices, type Device } from '../devices';
import { readWaiterStations, isStationMatch, normalizeStationId } from '../waiter-stations';
import type { KotPrintPayload, ReceiptPrintPayload } from './escpos';

export interface StationRoutedJob {
  stationId: string;
  stationName: string;
  targetDevice: Device | null;
  backupDevice: Device | null;
  payload: KotPrintPayload;
}

/**
 * Route order line items into station-specific KOT print payloads.
 */
export function routeOrderToStations(
  order: {
    id: string;
    number: number;
    table?: { label: string } | null;
    type: string;
    placedAt: Date;
    items: Array<{
      nameSnapshot: string;
      qty: number;
      station: string | null;
      modifiers: any;
      notes?: string | null;
    }>;
  },
  settings: unknown,
  waiterStation?: string | null,
): StationRoutedJob[] {
  const devices = readDevices(settings);
  const kotPrinters = devices.filter((d) => d.type === 'kot_printer' || d.type === 'both_printer');

  // Group line items by station slug (default to 'general' if null)
  const stationGroups = new Map<string, typeof order.items>();

  for (const item of order.items) {
    const stationSlug = (item.station?.trim().toLowerCase()) || 'general';
    if (!stationGroups.has(stationSlug)) {
      stationGroups.set(stationSlug, []);
    }
    stationGroups.get(stationSlug)!.push(item);
  }

  const routedJobs: StationRoutedJob[] = [];
  let kotSeq = 1;

  for (const [stationSlug, items] of stationGroups.entries()) {
    // Find designated devices for this station. Matching station printer receives these items.
    const stationPrinters = kotPrinters.filter(
      (p) => (p.station && p.station.trim().toLowerCase() === stationSlug) ||
             (p.station && p.station.trim().toUpperCase() === stationSlug.toUpperCase()) ||
             (!p.station && (stationSlug === 'general' || stationSlug === 'kitchen')) ||
             (p.kotRule === 'all_items')
    );
    const primaryDevice = stationPrinters.find((p) => p.isDefault || p.priority === 'primary') ||
                          stationPrinters[0] ||
                          (kotPrinters.find((p) => p.isDefault) || kotPrinters[0] || null);
    const backupDevice = stationPrinters.find((p) => p.id !== primaryDevice?.id) || null;
    const stationLabel = stationSlug === 'general' ? 'KOT' : stationSlug.toUpperCase();

    const payload: KotPrintPayload = {
      kotNumber: order.number * 10 + kotSeq++,
      orderNumber: order.number,
      tableLabel: order.table?.label ?? null,
      orderType: order.type,
      stationName: stationLabel,
      placedAt: order.placedAt,
      items: items.map((i) => ({
        name: i.nameSnapshot,
        qty: i.qty,
        notes: i.notes ?? null,
        modifiers: Array.isArray(i.modifiers) ? (i.modifiers as { name: string }[]) : [],
      })),
    };

    routedJobs.push({
      stationId: stationSlug,
      stationName: stationLabel,
      targetDevice: primaryDevice,
      backupDevice,
      payload,
    });
  }

  return routedJobs;
}

/**
 * Route table transfer notification into station-specific KOT print payloads.
 */
export function routeTransferToStations(
  order: {
    id: string;
    number: number;
    type: string;
    items: Array<{
      nameSnapshot: string;
      qty: number;
      station: string | null;
      modifiers: any;
      notes?: string | null;
    }>;
  },
  fromTableLabel: string,
  toTableLabel: string,
  transferredBy: string | null,
  settings: unknown,
): StationRoutedJob[] {
  const devices = readDevices(settings);
  const kotPrinters = devices.filter((d) => d.type === 'kot_printer' || d.type === 'both_printer');

  // Group line items by station slug (default to 'general' if null)
  const stationGroups = new Map<string, typeof order.items>();
  for (const item of order.items) {
    const stationSlug = item.station || 'general';
    if (!stationGroups.has(stationSlug)) {
      stationGroups.set(stationSlug, []);
    }
    stationGroups.get(stationSlug)!.push(item);
  }

  if (stationGroups.size === 0) {
    stationGroups.set('general', []);
  }

  const routedJobs: StationRoutedJob[] = [];
  let kotSeq = 1;

  for (const [stationSlug, items] of stationGroups.entries()) {
    const stationPrinters = kotPrinters.filter(
      (p) => p.station === stationSlug || (!p.station && (stationSlug === 'general' || stationSlug === 'kitchen')) || (p.kotRule === 'all_items')
    );
    const primaryDevice = stationPrinters.find((p) => p.isDefault) || stationPrinters[0] || (stationSlug === 'general' ? (kotPrinters.find((p) => p.isDefault) || kotPrinters[0] || null) : null);
    const backupDevice = stationPrinters.find((p) => p.id !== primaryDevice?.id) || null;

    const payload: KotPrintPayload = {
      kotNumber: order.number * 10 + kotSeq++,
      orderNumber: order.number,
      tableLabel: toTableLabel,
      orderType: order.type,
      stationName: stationSlug,
      isTransfer: true,
      fromTableLabel,
      toTableLabel,
      transferredBy,
      placedAt: new Date(),
      items: items.map((i) => ({
        name: i.nameSnapshot,
        qty: i.qty,
        notes: i.notes ?? null,
        modifiers: Array.isArray(i.modifiers) ? (i.modifiers as { name: string }[]) : [],
      })),
    };

    routedJobs.push({
      stationId: stationSlug,
      stationName: stationSlug,
      targetDevice: primaryDevice,
      backupDevice,
      payload,
    });
  }

  return routedJobs;
}

/**
 * Resolve target receipt/bill printer for billing / invoice settlement.
 * If waiterStation is provided, dynamically routes to the printer assigned to that staff/waiter station (e.g. P1, P2, P3, etc.).
 * Always respects the assigned station of the waiter.
 */
export function resolveReceiptPrinter(settings: unknown, waiterStation?: string | null): Device | null {
  const devices = readDevices(settings);
  if (devices.length === 0) return null;

  const stations = readWaiterStations(settings);

  if (waiterStation) {
    const normStation = normalizeStationId(waiterStation, stations);

    // 1. Find all printers assigned to this waiter's station
    const stationPrinters = devices.filter(
      (d) =>
        d.type !== 'display' &&
        d.type !== 'cash_drawer' &&
        (isStationMatch(d.station, waiterStation, stations) ||
         (normStation && isStationMatch(d.station, normStation, stations)))
    );

    if (stationPrinters.length > 0) {
      // a. Primary receipt / both printer designated for this station
      const primaryReceipt = stationPrinters.find(
        (d) => (d.type === 'receipt_printer' || d.type === 'both_printer') && (d.priority === 'primary' || d.isDefault)
      );
      if (primaryReceipt) return primaryReceipt;

      // b. Any receipt / both printer designated for this station
      const anyReceipt = stationPrinters.find((d) => d.type === 'receipt_printer' || d.type === 'both_printer');
      if (anyReceipt) return anyReceipt;

      // c. KOT printer designated for this station (in single thermal printer per station setups)
      const primaryKot = stationPrinters.find((d) => d.priority === 'primary' || d.isDefault) || stationPrinters[0];
      if (primaryKot) return primaryKot;
    }

    // 2. Name-based match fallback (e.g. printer named "P1 Printer", "P1 Billing", etc.)
    if (normStation) {
      const nameMatch = devices.find(
        (d) =>
          d.type !== 'display' &&
          d.type !== 'cash_drawer' &&
          (d.name.toLowerCase().includes(normStation) ||
           (waiterStation && d.name.toLowerCase().includes(waiterStation.trim().toLowerCase())))
      );
      if (nameMatch) return nameMatch;
    }
  }

  // Fallback: Default receipt printer, or first receipt/both printer, or first available non-display device
  const receiptPrinters = devices.filter((d) => d.type === 'receipt_printer' || d.type === 'both_printer');
  return receiptPrinters.find((d) => d.isDefault) || receiptPrinters[0] || devices.find((d) => d.type !== 'display') || null;
}
