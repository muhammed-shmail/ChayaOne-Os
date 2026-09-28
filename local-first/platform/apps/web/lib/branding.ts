import { prisma } from '@cafeos/db';
import { tenantHasFeature } from './features';

/**
 * ChayaOne — per-tenant white-label branding (Phase G9). Tenants with the
 * `white_label` feature ticked on can override logo / colors / app name and hide
 * the "Powered by ChayaOne" mark. Everyone else falls back to ChayaOne defaults.
 */
export type Branding = {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  colors: Record<string, string>;
  poweredBy: boolean;
};

const DEFAULTS: Branding = { appName: 'ChayaOne', logoUrl: '/logo chaya one.png', faviconUrl: '/app.png', colors: {}, poweredBy: true };

export async function getTenantBranding(tenantId: string): Promise<Branding> {
  const [b, whiteLabel] = await Promise.all([
    prisma.tenantBranding.findUnique({ where: { tenantId } }),
    tenantHasFeature(tenantId, 'white_label'),
  ]);
  // White-label is a tickable feature: without it, always show ChayaOne defaults.
  if (!b || !whiteLabel) return DEFAULTS;
  return {
    appName: b.appName ?? DEFAULTS.appName,
    logoUrl: b.logoUrl,
    faviconUrl: b.faviconUrl,
    colors: (b.colors ?? {}) as Record<string, string>,
    poweredBy: b.poweredBy,
  };
}
