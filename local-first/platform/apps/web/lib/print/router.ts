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
): StationRoutedJob[] {
  const devices = readDevices(settings);
  const kotPrinters = devices.filter((d) => d.type === 'kot_printer');

  // Group line items by station slug (default to 'kitchen' if null)
  const stationGroups = new Map<string, typeof order.items>();

  for (const item of order.items) {
    const stationSlug = item.station || 'kitchen';
    if (!stationGroups.has(stationSlug)) {
      stationGroups.set(stationSlug, []);
    }
    stationGroups.get(stationSlug)!.push(item);
  }

  const routedJobs: StationRoutedJob[] = [];
  let kotSeq = 1;

  for (const [stationSlug, items] of stationGroups.entries()) {
    // Find designated devices for this station
    const stationPrinters = kotPrinters.filter((p) => p.station === stationSlug || (!p.station && stationSlug === 'kitchen'));
    const primaryDevice = stationPrinters.find((p) => p.isDefault) || stationPrinters[0] || null;
    const backupDevice = stationPrinters.find((p) => p.id !== primaryDevice?.id) || null;

    const payload: KotPrintPayload = {
      kotNumber: order.number * 10 + kotSeq++,
      orderNumber: order.number,
      tableLabel: order.table?.label ?? null,
      orderType: order.type,
      stationName: stationSlug,
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
  const receiptPrinters = devices.filter((d) => d.type === 'receipt_printer');
  return receiptPrinters.find((d) => d.isDefault) || receiptPrinters[0] || null;
}
