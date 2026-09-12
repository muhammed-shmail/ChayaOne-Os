/**
 * Cafe OS — kitchens / prep stations.
 *
 * A "kitchen" (a.k.a. station) is a prep point that food routes to — a real
 * cafe might have 1, or 2+ (Hot Kitchen, Cold Kitchen, Bar, Dessert…). Each
 * menu item is assigned to one kitchen; orders split into one KOT per kitchen,
 * and the KDS can filter/consolidate per kitchen.
 *
 * Like floors/devices/gst, the kitchen list lives in the existing
 * `Outlet.settings` JSON — no schema change, fully reversible:
 *
 *   settings.kitchens → Kitchen[]
 *
 * The stable `id` is the *slug* stored on MenuItem.station / OrderItem.station /
 * Kot.station. Renaming a kitchen changes only `name` (the id/slug is left
 * intact), so existing items never orphan. An outlet that never touches this
 * gets the three legacy defaults, which keeps every pre-existing item mapped.
 */

export interface Kitchen {
  /** stable slug — the value written to *.station columns */
  id: string;
  /** display name shown on the KDS / menu editor */
  name: string;
  /** accent colour for the KDS chip (hex); optional */
  color?: string;
  sort: number;
}

/** Legacy stations — the value every existing menu item already carries. */
export const DEFAULT_KITCHENS: Kitchen[] = [
  { id: 'kitchen', name: 'Kitchen', color: '#c3492f', sort: 0 },
  { id: 'bar', name: 'Bar', color: '#d9a93a', sort: 1 },
  { id: 'dessert', name: 'Dessert', color: '#8e3b6b', sort: 2 },
];

/** Rotating palette for auto-coloured kitchens (used when none is set). */
export const KITCHEN_PALETTE = ['#c3492f', '#d9a93a', '#8e3b6b', '#2f7d6b', '#3b6fc3', '#b2593f', '#6b7d2f', '#a03b8e'];

/** Kitchen name max length (keeps KOT headers and KDS tabs tidy). */
export const KITCHEN_NAME_MAX = 24;

/** Build a stable, readable, URL-safe slug from a kitchen name. */
export function kitchenSlug(name: string): string {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);
}

/**
 * Read & normalize the kitchen list from Outlet.settings.kitchens. Never throws.
 * Falls back to the three legacy defaults when nothing is configured, so an
 * untouched outlet behaves exactly as before.
 */
export function readKitchens(settings: unknown): Kitchen[] {
  const raw = (settings as { kitchens?: unknown } | null)?.kitchens;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_KITCHENS;
  const seen = new Set<string>();
  const list = raw
    .map((k, i): Kitchen | null => {
      const o = k as Record<string, unknown>;
      if (!o || typeof o.id !== 'string' || !o.id || typeof o.name !== 'string' || !o.name) return null;
      if (seen.has(o.id)) return null;
      seen.add(o.id);
      const sort = Number(o.sort);
      const color = typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : KITCHEN_PALETTE[i % KITCHEN_PALETTE.length];
      return { id: o.id, name: o.name, color, sort: Number.isFinite(sort) ? sort : i };
    })
    .filter((k): k is Kitchen => k !== null)
    .sort((a, b) => a.sort - b.sort);
  return list.length ? list : DEFAULT_KITCHENS;
}

/** Resolve a station slug to its display name (falls back to a prettified slug). */
export function kitchenName(kitchens: Kitchen[], station: string | null | undefined): string {
  if (!station) return '';
  const hit = kitchens.find((k) => k.id === station);
  if (hit) return hit.name;
  // unknown/legacy slug — prettify: "cold-kitchen" → "Cold Kitchen"
  return station.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Resolve a station slug to its chip colour (falls back to a neutral tint). */
export function kitchenColor(kitchens: Kitchen[], station: string | null | undefined): string | null {
  if (!station) return null;
  const hit = kitchens.find((k) => k.id === station);
  return hit?.color ?? null;
}
