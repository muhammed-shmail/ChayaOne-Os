/**
 * Cafe OS — device & printer registry (client-safe)
 *
 * Devices (receipt/KOT/label printers) are stored in Outlet.settings.devices.
 * For server-side LAN pairing & tokens, see lib/device-pairing.ts.
 */

export const DEVICE_TYPES = [
  { value: 'receipt_printer', label: 'Receipt / Bill printer', icon: '🧾', station: true },
  { value: 'kot_printer', label: 'Kitchen (KOT) printer', icon: '🍳', station: true },
  { value: 'both_printer', label: 'Both (Billing & KOT)', icon: '⚡', station: true },
  { value: 'label_printer', label: 'Label printer', icon: '🏷️', station: false },
  { value: 'cash_drawer', label: 'Cash drawer', icon: '💵', station: false },
  { value: 'display', label: 'KDS Display', icon: '📺', station: true },
  { value: 'other', label: 'Other Device', icon: '⚙️', station: false },
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number]['value'];

export const DEVICE_CONNECTIONS = [
  { value: 'network', label: 'Network (LAN/IP — TCP 9100)' },
  { value: 'usb', label: 'USB Raw Port' },
  { value: 'bluetooth', label: 'Bluetooth Device' },
] as const;

export type DeviceConnection = (typeof DEVICE_CONNECTIONS)[number]['value'];

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  connection: DeviceConnection;
  /** IP:port for network, device path/id for USB/BT — free text, optional */
  target: string;
  ip?: string | null;
  port?: number | string | null;
  /** kitchen | bar | bakery | dessert | custom — only meaningful for KOT printers */
  station: string | null;
  priority?: 'primary' | 'backup';
  kotRule?: 'station_only' | 'all_items' | 'custom';
  /** how many copies to print (printers only) */
  copies: number;
  /** the default device for its type */
  isDefault: boolean;
  /** Live / persisted health status tracking */
  lastKnownStatus?: 'ONLINE' | 'UNREACHABLE' | 'CHECKING' | 'DISABLED' | 'NOT_CONFIGURED' | 'ERROR';
  lastCheckedAt?: string | null;
  lastLatencyMs?: number | null;
  lastError?: string | null;
}

const TYPE_VALUES = DEVICE_TYPES.map((t) => t.value) as readonly string[];
const CONN_VALUES = DEVICE_CONNECTIONS.map((c) => c.value) as readonly string[];

/** Read & normalize the device list from Outlet.settings.devices. Never throws. */
export function readDevices(settings: unknown): Device[] {
  const raw = (settings as { devices?: unknown } | null)?.devices;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d): Device | null => {
      const o = d as Record<string, unknown>;
      if (!o || typeof o.id !== 'string' || typeof o.name !== 'string') return null;
      const type = (TYPE_VALUES.includes(o.type as string) ? o.type : 'receipt_printer') as DeviceType;
      const connection = (CONN_VALUES.includes(o.connection as string) ? o.connection : 'network') as DeviceConnection;
      const copies = Number(o.copies);
      const target = typeof o.target === 'string' ? o.target : '';
      const ip = typeof o.ip === 'string' && o.ip ? o.ip : (target.split(':')[0] || '');
      const port = o.port ? String(o.port) : (target.split(':')[1] || '9100');
      const priority = o.priority === 'backup' ? 'backup' : 'primary';
      const kotRule = o.kotRule === 'all_items' ? 'all_items' : o.kotRule === 'custom' ? 'custom' : 'station_only';
      const lastKnownStatus = typeof o.lastKnownStatus === 'string' ? (o.lastKnownStatus as Device['lastKnownStatus']) : undefined;
      const lastCheckedAt = typeof o.lastCheckedAt === 'string' ? o.lastCheckedAt : null;
      const lastLatencyMs = typeof o.lastLatencyMs === 'number' ? o.lastLatencyMs : null;
      const lastError = typeof o.lastError === 'string' ? o.lastError : null;

      return {
        id: o.id,
        name: o.name,
        type,
        connection,
        target: target || (ip ? `${ip}:${port}` : ''),
        ip: ip || null,
        port: port || '9100',
        station: typeof o.station === 'string' && o.station ? o.station : null,
        priority,
        kotRule,
        copies: Number.isFinite(copies) && copies >= 1 ? Math.min(5, Math.round(copies)) : 1,
        isDefault: !!o.isDefault,
        lastKnownStatus,
        lastCheckedAt,
        lastLatencyMs,
        lastError,
      };
    })
    .filter((d): d is Device => d !== null);
}

/** Ensure at most one default per device type (last-write-wins for the flagged one). */
export function normalizeDefaults(devices: Device[], preferId?: string): Device[] {
  const seen = new Set<string>();
  if (preferId) {
    const pref = devices.find((d) => d.id === preferId);
    if (pref) {
      for (const d of devices) if (d.type === pref.type) d.isDefault = d.id === preferId;
    }
  }
  return devices.map((d) => {
    if (d.isDefault && !seen.has(d.type)) {
      seen.add(d.type);
      return d;
    }
    return d.isDefault && seen.has(d.type) ? { ...d, isDefault: false } : d;
  });
}
