/**
 * ChayaOne — feature catalogue (single source of truth for the "tick model").
 *
 * Every tickable module is declared here once. The super-admin Feature Access
 * panel renders this list, and `lib/features.ts` resolves the effective flag for
 * a tenant as:  featureOverrides[key] ?? plan.features[key] ?? defaultOn.
 *
 * `defaultOn` is the safety net: modules that are already live for everyone
 * (CRM, Revenue, PWA, Games, Loyalty) default ON so adding enforcement gates
 * never silently disables a working cafe. Growth/branding extras default OFF.
 *
 * IMPORTANT: keys here must match the keys used in `PlanDefinition.features`
 * (see `packages/db/prisma/seed.ts`) and the strings passed to
 * `tenantHasFeature(...)` at each gate. A typo silently disables a module.
 */
export type FeatureKey =
  | 'ai_assistant'
  | 'revenue_analytics'
  | 'crm'
  | 'pwa_customer_app'
  | 'games'
  | 'loyalty'
  | 'whatsapp'
  | 'white_label';

export type FeatureDef = {
  key: FeatureKey;
  label: string;
  description: string;
  category: 'Insights' | 'Engagement' | 'Growth' | 'Branding';
  defaultOn: boolean;
};

export const FEATURE_CATALOG: FeatureDef[] = [
  { key: 'revenue_analytics', label: 'Revenue Analytics', category: 'Insights', defaultOn: true,
    description: 'Revenue trends, KPIs and the analytics panel on the owner dashboard.' },
  { key: 'ai_assistant', label: 'AI Sales Assistant', category: 'Insights', defaultOn: false,
    description: 'Natural-language sales assistant (Gemini) on the owner dashboard.' },
  { key: 'crm', label: 'Customer Management', category: 'Engagement', defaultOn: true,
    description: 'Customer directory, segments and the CRM dashboard.' },
  { key: 'pwa_customer_app', label: 'Customer PWA', category: 'Engagement', defaultOn: true,
    description: 'The QR-ordering customer web app (storefront, profile, ordering).' },
  { key: 'games', label: 'Play & Games', category: 'Engagement', defaultOn: true,
    description: 'In-PWA games and spin-the-wheel rewards.' },
  { key: 'loyalty', label: 'Loyalty & Points', category: 'Engagement', defaultOn: true,
    description: 'Points wallet, rewards redemption and the loyalty dashboard.' },
  { key: 'whatsapp', label: 'WhatsApp Messaging', category: 'Growth', defaultOn: false,
    description: 'Deliver OTP and customer messages over WhatsApp.' },
  { key: 'white_label', label: 'White-label Branding', category: 'Branding', defaultOn: false,
    description: 'Apply the cafe’s own app name and logo across customer surfaces.' },
];

/** key -> defaultOn, used as the resolution fallback in lib/features.ts. */
export const FEATURE_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  FEATURE_CATALOG.map((f) => [f.key, f.defaultOn]),
);
