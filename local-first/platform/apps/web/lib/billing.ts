import { prisma } from '@cafeos/db';
import { LicenseService } from './license/license-service';

/**
 * ChayaOne — tenant billing state & commercial license gate.
 * Operational actions (orders, settlements, KOTs) are blocked when the tenant
 * is suspended or its commercial license has lapsed/expired.
 */
const TTL_MS = 10_000;
const cache = new Map<string, { blocked: boolean; reason: string | null; at: number }>();

export async function tenantBilling(tenantId: string): Promise<{ blocked: boolean; reason: string | null }> {
  // 1. Check Commercial Main PC License
  try {
    const licenseCheck = await LicenseService.isLicenseActive();
    if (!licenseCheck.active) {
      return { blocked: true, reason: 'license_expired' };
    }
  } catch (err) {
    // If license check throws, fall through to tenant check
  }

  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return { blocked: hit.blocked, reason: hit.reason };

  let t: any = null;
  try {
    t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true, subscription: { select: { status: true } } },
    });
  } catch {
    // Offline mode / DB unavailable: allow local operation when license is active
  }
  const subStatus = t?.subscription?.status ?? null;
  const blocked =
    t?.status === 'suspended' || subStatus === 'suspended' || subStatus === 'expired' || subStatus === 'cancelled';
  const reason = blocked ? subStatus ?? t?.status ?? 'suspended' : null;

  cache.set(tenantId, { blocked, reason, at: Date.now() });
  return { blocked, reason };
}

export function clearBillingCache(): void {
  cache.clear();
}

