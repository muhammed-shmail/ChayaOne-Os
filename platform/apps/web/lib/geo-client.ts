/**
 * Browser-side geolocation capture for the location gate (lib/geo.ts).
 *
 * Wraps `navigator.geolocation.getCurrentPosition` in a promise that NEVER
 * rejects — on denial, timeout, or an unsupported browser it resolves to `{}`.
 * That keeps the lenient order paths simple (send whatever we have and proceed);
 * the strict attendance path is enforced server-side, which rejects the empty
 * header set. Attach the returned object straight onto a fetch's `headers`.
 */
export async function getGeoHeaders(timeoutMs = 3000): Promise<Record<string, string>> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return {};
  return new Promise((resolve) => {
    let settled = false;
    const done = (h: Record<string, string>) => { if (!settled) { settled = true; resolve(h); } };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => done({
          'x-geo-lat': String(pos.coords.latitude),
          'x-geo-lng': String(pos.coords.longitude),
          'x-geo-acc': String(Math.round(pos.coords.accuracy || 0)),
        }),
        () => done({}),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
      );
    } catch {
      done({});
    }
    // hard backstop in case the callback never fires
    setTimeout(() => done({}), timeoutMs + 500);
  });
}
