import { prisma } from '@cafeos/db';

/**
 * Per-outlet location gate ("geofence"), stored in `Outlet.settings.location`.
 *
 * When enabled, the owner pins the cafe at (lat, lng) with a metre radius and
 * everyone EXCEPT the owner must be inside that circle for a gated action to
 * succeed. It exists to stop two abuses:
 *   - customers placing table-QR orders without actually being at the cafe, and
 *   - staff marking attendance (clocking in) from off-site.
 *
 * Mirrors lib/tax.ts (readGstConfig/getOutletGst): a JSON sub-object on the
 * existing settings blob — no schema change, fully reversible, and a defensive
 * reader so an outlet with no `location` block behaves EXACTLY as before
 * (enabled:false ⇒ every gate is a no-op).
 *
 * The gate for a given action is only ACTIVE when
 *   enabled && lat != null && lng != null && gate<Action>.
 *
 * Fail policy is decided by the CALLER, not stored here:
 *   - strict  (attendance): a missing GPS fix is rejected.
 *   - lenient (orders):     a missing GPS fix is allowed; only a confirmed
 *                           out-of-range position is rejected.
 */
export interface OutletLocation {
  enabled: boolean;        // master switch — default false (feature OFF)
  lat: number | null;      // cafe latitude
  lng: number | null;      // cafe longitude
  radiusM: number;         // allowed radius in metres (default 100)
  gateQrOrders: boolean;   // gate customer table-QR ordering
  gatePosOrders: boolean;  // gate staff POS ordering
  gateAttendance: boolean; // gate staff clock-in
}

export const DEFAULT_LOCATION: OutletLocation = {
  enabled: false,
  lat: null,
  lng: null,
  radiusM: 100,
  gateQrOrders: true,
  gatePosOrders: true,
  gateAttendance: true,
};

/** Clamp helpers keep persisted config sane regardless of what was stored. */
export const RADIUS_MIN = 10;
export const RADIUS_MAX = 5000;
const clampRadius = (r: number) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(r)));
const validLat = (v: number) => Number.isFinite(v) && v >= -90 && v <= 90;
const validLng = (v: number) => Number.isFinite(v) && v >= -180 && v <= 180;

/** Read & normalize the location gate from Outlet.settings.location. Never throws. */
export function readOutletLocation(settings: unknown): OutletLocation {
  const s = (settings ?? {}) as Record<string, unknown>;
  const l = (s.location ?? {}) as Record<string, unknown>;
  const lat = Number(l.lat);
  const lng = Number(l.lng);
  const radius = Number(l.radiusM);
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    enabled: bool(l.enabled, false),
    lat: validLat(lat) ? lat : null,
    lng: validLng(lng) ? lng : null,
    radiusM: Number.isFinite(radius) ? clampRadius(radius) : DEFAULT_LOCATION.radiusM,
    gateQrOrders: bool(l.gateQrOrders, true),
    gatePosOrders: bool(l.gatePosOrders, true),
    gateAttendance: bool(l.gateAttendance, true),
  };
}

/** Load an outlet's location gate (one small query). Mirrors getOutletGst. */
export async function getOutletLocation(outletId: string): Promise<OutletLocation> {
  const o = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
  return readOutletLocation(o?.settings);
}

/** Sanitize an owner-submitted config into a storable OutletLocation. */
export function normalizeLocationInput(input: unknown): OutletLocation {
  const i = (input ?? {}) as Record<string, unknown>;
  const lat = Number(i.lat);
  const lng = Number(i.lng);
  const radius = Number(i.radiusM);
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    enabled: bool(i.enabled, false),
    lat: validLat(lat) ? lat : null,
    lng: validLng(lng) ? lng : null,
    radiusM: Number.isFinite(radius) ? clampRadius(radius) : DEFAULT_LOCATION.radiusM,
    gateQrOrders: bool(i.gateQrOrders, true),
    gatePosOrders: bool(i.gatePosOrders, true),
    gateAttendance: bool(i.gateAttendance, true),
  };
}

/** Great-circle distance between two WGS-84 points, in metres (haversine). */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // mean Earth radius (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** A device position, as sent by the browser (accM = reported accuracy in metres). */
export interface GeoFix { lat: number; lng: number; accM: number }

/** Parse the caller's position from x-geo-* headers, or null when absent/invalid. */
export function readGeoFromHeaders(h: Headers): GeoFix | null {
  const lat = Number(h.get('x-geo-lat'));
  const lng = Number(h.get('x-geo-lng'));
  if (!validLat(lat) || !validLng(lng)) return null;
  const acc = Number(h.get('x-geo-acc'));
  return { lat, lng, accM: Number.isFinite(acc) && acc > 0 ? acc : 0 };
}

export type GeofenceResult =
  | { ok: true }
  | { ok: false; reason: 'no_fix' | 'out_of_range'; radiusM: number; distanceM?: number };

/**
 * Decide whether a gated action may proceed given the outlet's location gate and
 * the caller's reported position. `strict` chooses the missing-fix policy.
 *
 * Callers must have already confirmed the relevant gate is ON (enabled + gateX);
 * if the gate isn't configured (no pin) this still returns ok as a safety net.
 * A device's own accuracy radius is subtracted before comparing, so a phone that
 * reports "±30 m" isn't wrongly rejected right at the boundary.
 */
export function checkGeofence(loc: OutletLocation, geo: GeoFix | null, opts: { strict: boolean }): GeofenceResult {
  if (!loc.enabled || loc.lat === null || loc.lng === null) return { ok: true };
  if (!geo) return opts.strict ? { ok: false, reason: 'no_fix', radiusM: loc.radiusM } : { ok: true };
  const distanceM = haversineMeters(loc.lat, loc.lng, geo.lat, geo.lng);
  if (distanceM - geo.accM <= loc.radiusM) return { ok: true };
  return { ok: false, reason: 'out_of_range', radiusM: loc.radiusM, distanceM: Math.round(distanceM) };
}
