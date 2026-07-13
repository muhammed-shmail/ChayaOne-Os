/**
 * Best-effort Google Drive mirror for owner-uploaded images. Local disk stays
 * the live serving source (Drive links don't embed reliably); every upload is
 * ALSO copied into a Drive folder as an off-site backup when the `GDRIVE_*` env
 * vars are set.
 *
 * Auth is OAuth 2.0 with a long-lived refresh token for the account that owns
 * the target folder — the reliable path for a personal Gmail folder (a service
 * account has no My-Drive quota and its uploads fail). No `googleapis`
 * dependency: token refresh + a multipart upload over plain fetch.
 *
 * `mirrorToDrive` NEVER throws and NEVER blocks the served result — a Drive
 * outage or bad credential just logs and returns null; the local write already
 * succeeded by the time it runs.
 */

type DriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
};

function readConfig(): DriveConfig | null {
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;
  const folderId = process.env.GDRIVE_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken || !folderId) return null;
  return { clientId, clientSecret, refreshToken, folderId };
}

/** True when the Drive mirror is fully configured. */
export function isDriveConfigured(): boolean {
  return readConfig() !== null;
}

// Access tokens live ~1h; cache module-side so bursts of uploads don't each
// hit the token endpoint. Refreshed lazily when within 60s of expiry.
let cachedToken: { value: string; expMs: number } | null = null;

async function getAccessToken(cfg: DriveConfig): Promise<string> {
  if (cachedToken && cachedToken.expMs - 60_000 > Date.now()) return cachedToken.value;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`token refresh failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expMs: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

/**
 * Copy bytes into the configured Drive folder. Returns the created file id, or
 * null if the mirror isn't configured or the push failed (already logged).
 */
export async function mirrorToDrive(
  name: string,
  body: Buffer,
  contentType: string,
): Promise<string | null> {
  const cfg = readConfig();
  if (!cfg) return null;

  try {
    const token = await getAccessToken(cfg);

    const boundary = `cafeos-${crypto.randomUUID()}`;
    const metadata = JSON.stringify({ name, parents: [cfg.folderId] });
    const pre = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
      'utf8',
    );
    const post = Buffer.from(`\r\n--${boundary}--`, 'utf8');
    const payload = Buffer.concat([pre, body, post]);
    const bytes = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/related; boundary=${boundary}`,
        },
        body: bytes as unknown as BodyInit,
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`drive upload failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as { id: string };
    return json.id;
  } catch (err) {
    // Best-effort: never fail the caller's upload because the mirror hiccuped.
    console.error('[gdrive] mirror failed', err);
    return null;
  }
}
