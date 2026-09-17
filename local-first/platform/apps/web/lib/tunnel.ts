import fs from 'fs';
import path from 'path';

export interface TunnelStatusInfo {
  active: boolean;
  publicUrl: string | null;
  qrOrderUrl: string | null;
  mode?: string;
  startedAt?: string;
}

/**
 * Server-side helper to read active Cloudflare Tunnel configuration.
 */
export function getActiveTunnelInfo(): TunnelStatusInfo {
  // 1. Check explicit environment variables
  if (process.env.PUBLIC_URL) {
    const url = process.env.PUBLIC_URL.replace(/\/$/, '');
    return {
      active: true,
      publicUrl: url,
      qrOrderUrl: `${url}/app?t=`,
      mode: 'env',
    };
  }

  // 2. Check tunnel-info.json in possible locations
  const candidates: string[] = [];

  // Local platform dir
  candidates.push(path.resolve(process.cwd(), 'tunnel-info.json'));
  candidates.push(path.resolve(process.cwd(), '../..', 'tunnel-info.json'));

  // UserData dir on Windows
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, '@cafeos', 'desktop', 'tunnel-info.json'));
  }

  for (const f of candidates) {
    if (fs.existsSync(f)) {
      try {
        const raw = fs.readFileSync(f, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.active && parsed.publicUrl) {
          return {
            active: true,
            publicUrl: parsed.publicUrl.replace(/\/$/, ''),
            qrOrderUrl: parsed.qrOrderUrl || `${parsed.publicUrl}/app?t=`,
            mode: parsed.mode || 'quick',
            startedAt: parsed.startedAt,
          };
        }
      } catch {}
    }
  }

  return {
    active: false,
    publicUrl: null,
    qrOrderUrl: null,
  };
}
