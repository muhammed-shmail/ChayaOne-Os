/**
 * ChayaOne OS — Runtime Configuration Module
 *
 * Single-source of truth for determining system execution mode:
 *  - mode: 'local' (standalone Main PC runtime) | 'hybrid' (local + cloud sync) | 'cloud' (cloud-only)
 *  - cloudEnabled: whether optional cloud services (Supabase/Gemini/Sync) are active
 *  - database: 'local' | 'cloud'
 */

export interface RuntimeConfig {
  mode: 'local' | 'hybrid' | 'cloud';
  cloudEnabled: boolean;
  database: 'local' | 'cloud';
  subdomain: string;
}

export function getRuntimeConfig(): RuntimeConfig {
  const mode = (process.env.CHAYAONE_RUNTIME_MODE || 'local').toLowerCase() as 'local' | 'hybrid' | 'cloud';
  const cloudEnabled = process.env.CHAYAONE_CLOUD_ENABLED === 'true';
  const dbUrl = process.env.DATABASE_URL || '';
  const database = (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('5433')) ? 'local' : 'cloud';
  const subdomain = process.env.DEV_TENANT_SUBDOMAIN || 'kahwa';

  return {
    mode,
    cloudEnabled,
    database,
    subdomain,
  };
}

export function isLocalRuntime(): boolean {
  return getRuntimeConfig().mode === 'local';
}
