import { prisma } from '@cafeos/db';
import { FEATURE_DEFAULTS } from './feature-catalog';

/**
 * ChayaOne — plan + per-tenant feature flags (Phase G9 / tick model).
 *
 * Effective flag = featureOverrides[key]   (per-cafe Force ON/OFF, if boolean)
 *               ?? plan.features[key]       (plan default, if boolean)
 *               ?? FEATURE_DEFAULTS[key]    (catalogue safety net)
 *
 * Per-tenant overrides live on `Subscription.featureOverrides` (mirrors
 * `slotOverrides`). Cached briefly so gates are cheap on the hot path.
 */
const TTL_MS = 30_000;
const cache = new Map<string, { features: Record<string, boolean>; at: number }>();

export async function tenantFeatures(tenantId: string): Promise<Record<string, boolean>> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.features;

  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { featureOverrides: true, plan: { select: { features: true } } },
  });
  const plan = (sub?.plan.features ?? {}) as Record<string, unknown>;
  const overrides = (sub?.featureOverrides ?? {}) as Record<string, unknown>;

  // Start from catalogue defaults, then layer plan defaults, then per-cafe overrides.
  const features: Record<string, boolean> = { ...FEATURE_DEFAULTS };
  for (const [k, v] of Object.entries(plan)) if (typeof v === 'boolean') features[k] = v;
  for (const [k, v] of Object.entries(overrides)) if (typeof v === 'boolean') features[k] = v;

  cache.set(tenantId, { features, at: Date.now() });
  return features;
}

export async function tenantHasFeature(tenantId: string, flag: string): Promise<boolean> {
  return !!(await tenantFeatures(tenantId))[flag];
}
