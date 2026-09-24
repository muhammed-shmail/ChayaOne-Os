/**
 * Cafe OS — Waiter Floor Stations / Section Arrangement
 *
 * Provides station management for floor staff (Waiters), allowing table sections
 * like Lower Floor (P1), Middle Floor (P2), Upper Floor (P3), and custom stations
 * to be assigned to waiters.
 *
 * When a waiter assigned to a station (e.g. P1) creates or modifies an order,
 * print routing directs the KOT to the physical printer designated for that station.
 */

export interface WaiterStation {
  id: string; // Slug, e.g. 'p1', 'p2', 'p3', 'p4', 'terrace'
  code: string; // 'P1', 'P2', 'P3'
  name: string; // 'Lower', 'Middle', 'Upper'
  label: string; // 'P1 (Lower)'
  desc?: string;
  isCustom?: boolean;
}

export const DEFAULT_WAITER_STATIONS: WaiterStation[] = [
  {
    id: 'p1',
    code: 'P1',
    name: 'Lower',
    label: 'P1 (Lower)',
    desc: 'Ground / Lower Floor Section',
    isCustom: false,
  },
  {
    id: 'p2',
    code: 'P2',
    name: 'Middle',
    label: 'P2 (Middle)',
    desc: 'Middle Floor Section',
    isCustom: false,
  },
  {
    id: 'p3',
    code: 'P3',
    name: 'Upper',
    label: 'P3 (Upper)',
    desc: 'Upper Floor / Mezzanine Section',
    isCustom: false,
  },
];

/** Read & normalize configured waiter stations from Outlet.settings.waiterStations. Never throws. */
export function readWaiterStations(settings: unknown): WaiterStation[] {
  const raw = (settings as { waiterStations?: unknown } | null)?.waiterStations;
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_WAITER_STATIONS;
  }

  const customList: WaiterStation[] = [];
  const seenIds = new Set<string>();

  // Add default stations first
  for (const def of DEFAULT_WAITER_STATIONS) {
    seenIds.add(def.id.toLowerCase());
    customList.push(def);
  }

  // Add custom stations from settings
  for (const item of raw) {
    const obj = item as Record<string, unknown>;
    if (!obj || typeof obj.id !== 'string') continue;
    const id = obj.id.trim().toLowerCase();
    if (!id || seenIds.has(id)) continue;

    const code = typeof obj.code === 'string' && obj.code ? obj.code.trim().toUpperCase() : id.toUpperCase();
    const name = typeof obj.name === 'string' && obj.name ? obj.name.trim() : code;
    const label = typeof obj.label === 'string' && obj.label ? obj.label.trim() : `${code} (${name})`;
    const desc = typeof obj.desc === 'string' ? obj.desc.trim() : 'Custom Floor Station';

    seenIds.add(id);
    customList.push({
      id,
      code,
      name,
      label,
      desc,
      isCustom: true,
    });
  }

  return customList;
}

/** Format a station ID into a human-readable badge label (e.g. 'P1 · Lower'). */
export function formatStationBadge(stationId: string | null | undefined, customList?: WaiterStation[]): string {
  if (!stationId) return 'Unassigned';
  const clean = stationId.trim().toLowerCase();
  const list = customList && customList.length > 0 ? customList : DEFAULT_WAITER_STATIONS;
  const match = list.find((s) => s.id.toLowerCase() === clean || s.code.toLowerCase() === clean);
  if (match) {
    return `${match.code} · ${match.name}`;
  }
  return stationId.toUpperCase();
}

/** Check if two station identifiers refer to the same station. */
export function isStationMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  return cleanA === cleanB;
}
