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
    name: 'Upper',
    label: 'P2 (Upper)',
    desc: 'Upper Floor / Mezzanine Section',
    isCustom: false,
  },
];

/** Read & normalize configured stations from Outlet.settings. Returns a unified list of stations. Never throws. */
export function readWaiterStations(settings: unknown): WaiterStation[] {
  const s = settings as { waiterStations?: unknown; kitchens?: unknown; stations?: unknown; deletedDefaultStations?: unknown } | null;
  const rawStations = Array.isArray(s?.stations) ? s!.stations : [];
  const rawWaiter = Array.isArray(s?.waiterStations) ? s!.waiterStations : [];
  const rawKitchens = Array.isArray(s?.kitchens) ? s!.kitchens : [];

  const raw = [...rawStations, ...rawWaiter];
  const list: WaiterStation[] = [];
  const seenIds = new Set<string>();

  for (const item of raw) {
    const obj = item as Record<string, unknown>;
    if (!obj || typeof obj.id !== 'string') continue;
    const id = obj.id.trim().toLowerCase();
    if (!id || seenIds.has(id)) continue;

    const code = typeof obj.code === 'string' && obj.code ? obj.code.trim().toUpperCase() : id.toUpperCase();
    const name = typeof obj.name === 'string' && obj.name ? obj.name.trim() : code;
    const label = typeof obj.label === 'string' && obj.label ? obj.label.trim() : `${code} (${name})`;
    const desc = typeof obj.desc === 'string' ? obj.desc.trim() : 'Station';

    seenIds.add(id);
    list.push({
      id,
      code,
      name,
      label,
      desc,
      isCustom: obj.isCustom !== false,
    });
  }

  // Ensure standard baseline floor stations (P1, P2) are present unless explicitly removed
  const deletedDefaults = Array.isArray(s?.deletedDefaultStations) ? (s!.deletedDefaultStations as string[]) : [];
  for (const def of DEFAULT_WAITER_STATIONS) {
    if (!seenIds.has(def.id) && !deletedDefaults.includes(def.id)) {
      seenIds.add(def.id);
      list.push(def);
    }
  }

  for (const k of rawKitchens) {
    const obj = k as Record<string, unknown>;
    if (!obj || typeof obj.id !== 'string') continue;
    const id = obj.id.trim().toLowerCase();
    if (!id || seenIds.has(id)) continue;
    const code = typeof obj.code === 'string' && obj.code ? obj.code.trim().toUpperCase() : id.slice(0, 4).toUpperCase();
    const name = typeof obj.name === 'string' && obj.name ? obj.name.trim() : code;
    seenIds.add(id);
    list.push({
      id,
      code,
      name,
      label: `${code} (${name})`,
      desc: 'Prep & Floor Station',
      isCustom: true,
    });
  }

  return list.length > 0 ? list : DEFAULT_WAITER_STATIONS;
}

export const readUnifiedStations = readWaiterStations;

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

/**
 * Normalizes any station string (e.g. 'p1', 'P1', 'P1 (Lower)', 'Lower')
 * to its canonical station ID ('p1', 'p2', etc.) based on configured stations.
 */
export function normalizeStationId(val: string | null | undefined, customList?: WaiterStation[]): string | null {
  if (!val) return null;
  const clean = val.trim().toLowerCase();
  if (!clean) return null;

  const list = customList && customList.length > 0 ? customList : DEFAULT_WAITER_STATIONS;

  // 1. Direct match by id or code
  const exact = list.find((s) => s.id.toLowerCase() === clean || s.code.toLowerCase() === clean);
  if (exact) return exact.id.toLowerCase();

  // 2. Direct match by name or label
  const nameOrLabel = list.find(
    (s) => s.name.toLowerCase() === clean || s.label.toLowerCase() === clean
  );
  if (nameOrLabel) return nameOrLabel.id.toLowerCase();

  // 3. Match if string contains code or id as distinct token/prefix (e.g. "P1 (Lower)", "P1 - Ground", "P1 Floor")
  for (const s of list) {
    const sId = s.id.toLowerCase();
    const sCode = s.code.toLowerCase();
    if (clean === sId || clean === sCode) return sId;
    if (
      clean.startsWith(`${sCode} `) ||
      clean.startsWith(`${sId} `) ||
      clean.startsWith(`${sCode}(`) ||
      clean.startsWith(`${sId}(`) ||
      clean.startsWith(`${sCode}-`) ||
      clean.startsWith(`${sId}-`)
    ) {
      return sId;
    }
    const tokens = clean.split(/[^a-z0-9]+/);
    if (tokens.includes(sId) || tokens.includes(sCode)) {
      return sId;
    }
  }

  // 4. Fallback regex match for station pattern like "p1", "p2", "p3", "p4"
  const pMatch = clean.match(/^p\d+/i);
  if (pMatch) return pMatch[0].toLowerCase();

  return clean;
}

/** Check if two station identifiers refer to the same station. */
export function isStationMatch(
  a: string | null | undefined,
  b: string | null | undefined,
  customList?: WaiterStation[]
): boolean {
  if (!a || !b) return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (cleanA === cleanB) return true;

  const normA = normalizeStationId(a, customList);
  const normB = normalizeStationId(b, customList);
  if (normA && normB && normA === normB) return true;

  return false;
}
