import { readDevices, type Device } from '../devices';
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

  // If order was placed by a waiter in an assigned section/station (e.g. 'p1', 'p2', 'p3')
  // and there is a physical printer configured specifically for that station, route directly to it.
  const waiterStationClean = waiterStation?.trim().toLowerCase();
  const waiterPrinters = waiterStationClean
    ? kotPrinters.filter((p) => p.station?.trim().toLowerCase() === waiterStationClean)
    : [];

  if (waiterStationClean && waiterPrinters.length > 0) {
    const primaryDevice: Device | null = waiterPrinters.find((p) => p.isDefault || p.priority === 'primary') || waiterPrinters[0] || null;
    const backupDevice: Device | null = waiterPrinters.find((p) => p.id !== primaryDevice?.id) || null;
    const stationLabel = waiterStationClean.toUpperCase();

    const payload: KotPrintPayload = {
      kotNumber: order.number * 10 + 1,
      orderNumber: order.number,
      tableLabel: order.table?.label ?? null,
      orderType: order.type,
      stationName: stationLabel,
      placedAt: order.placedAt,
      items: order.items.map((i) => ({
        name: i.nameSnapshot,
        qty: i.qty,
        notes: i.notes ?? null,
        modifiers: Array.isArray(i.modifiers) ? (i.modifiers as { name: string }[]) : [],
      })),
    };

    return [
      {
        stationId: waiterStationClean,
        stationName: stationLabel,
        targetDevice: primaryDevice,
        backupDevice,
        payload,
      },
    ];
  }

  // Group line items by station slug (default to 'general' if null)
  const stationGroups = new Map<string, typeof order.items>();

  for (const item of order.items) {
    const stationSlug = item.station || 'general';
    if (!stationGroups.has(stationSlug)) {
      stationGroups.set(stationSlug, []);
    }
    stationGroups.get(stationSlug)!.push(item);
  }

  const routedJobs: StationRoutedJob[] = [];
  let kotSeq = 1;

  for (const [stationSlug, items] of stationGroups.entries()) {
    // Find designated devices for this station. General printers (no station) or all_items printers handle general/unassigned items.
    const stationPrinters = kotPrinters.filter(
      (p) => p.station === stationSlug || (!p.station && (stationSlug === 'general' || stationSlug === 'kitchen')) || (p.kotRule === 'all_items')
    );
    const primaryDevice = stationPrinters.find((p) => p.isDefault) || stationPrinters[0] || (stationSlug === 'general' ? (kotPrinters.find((p) => p.isDefault) || kotPrinters[0] || null) : null);
    const backupDevice = stationPrinters.find((p) => p.id !== primaryDevice?.id) || null;

    const payload: KotPrintPayload = {
      kotNumber: order.number * 10 + kotSeq++,
      orderNumber: order.number,
      tableLabel: order.table?.label ?? null,
      orderType: order.type,
      stationName: stationSlug === 'general' ? 'KOT' : stationSlug,
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
      stationName: stationSlug === 'general' ? 'KOT' : stationSlug,
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
 * Resolve target receipt printer for billing / invoice settlement.
 */
export function resolveReceiptPrinter(settings: unknown): Device | null {
  const devices = readDevices(settings);
  const receiptPrinters = devices.filter((d) => d.type === 'receipt_printer' || d.type === 'both_printer');
  return receiptPrinters.find((d) => d.isDefault) || receiptPrinters[0] || null;
}
