/**
 * Object-storage seam for owner-uploaded images (logos, PWA banners,
 * featured-dish photos). Backed by Supabase Storage when the `SUPABASE_*` env
 * vars are set; otherwise the caller falls back to local disk (fine for local
 * dev, but note ephemeral hosts like Railway wipe local files on redeploy —
 * which is exactly why production must be configured).
 *
 * Uses Supabase's native Storage REST API over plain fetch (no SDK): a raw PUT
 * with the service-role key. The bucket must be public so the returned
 * `/object/public/…` URL embeds without a signed token.
 */

type SupabaseConfig = {
  url: string; // https://<project-ref>.supabase.co  (no trailing slash)
  serviceKey: string; // service_role key — server-side only, full storage access
  bucket: string; // e.g. "uploads"
};

function readConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET;
  if (!url || !serviceKey || !bucket) return null;
  return { url: url.replace(/\/$/, ''), serviceKey, bucket };
}

/** True when remote object storage is fully configured. */
export function isRemoteStorageConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Upload bytes to Supabase Storage and return the public URL, or `null` if
 * remote storage isn't configured (the caller then falls back to local disk).
 * Throws only when a *configured* store rejects the upload, so misconfiguration
 * surfaces instead of silently degrading to ephemeral local writes.
 */
export async function putImage(key: string, body: Buffer, contentType: string): Promise<string | null> {
  const cfg = readConfig();
  if (!cfg) return null;

  const objectPath = key.replace(/^\/+/, '');
  const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);

  const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: cfg.serviceKey,
      authorization: `Bearer ${cfg.serviceKey}`,
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-upsert': 'true',
    },
    body: bytes as unknown as BodyInit,
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase upload failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  return `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${objectPath}`;
}
