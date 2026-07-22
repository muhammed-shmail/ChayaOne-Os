import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform-session';
import { getTenantDetail } from '@/lib/platform-tenants';
import { TenantActions } from './TenantActions';
import { TenantSettings } from './TenantSettings';
import { FeatureAccess } from './FeatureAccess';
import { TenantSubscription } from './TenantSubscription';
import { TenantPayment } from './TenantPayment';
import { FEATURE_CATALOG, FEATURE_DEFAULTS } from '@/lib/feature-catalog';

export const dynamic = 'force-dynamic';

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default async function TenantDetail({ params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  const t = await getTenantDetail(params.id);
  if (!t) notFound();

  const sub = t.subscription;
  const usage = Object.fromEntries(t.usage.map((u) => [u.metric, u.value]));
  const subProps = sub ? {
    planKey: sub.plan.key,
    period: sub.period,
    status: sub.status,
    currentEnd: sub.currentEnd ? new Date(sub.currentEnd).toISOString().split('T')[0]! : '',
    customPriceMonthlyPaise: sub.customPriceMonthlyPaise,
    customPriceYearlyPaise: sub.customPriceYearlyPaise,
  } : undefined;

  const so = (sub?.slotOverrides ?? {}) as Record<string, number | null | undefined>;
  const slotStr = (k: string) => (so[k] === undefined ? '' : so[k] === null ? 'unlimited' : String(so[k]));

  // Feature access (tick model): effective-without-override = plan flag ?? catalogue default.
  const planFeatures = (sub?.plan.features ?? {}) as Record<string, boolean>;
  const featureOverrides = (sub?.featureOverrides ?? {}) as Record<string, boolean>;
  const inheritedFeatures = Object.fromEntries(
    FEATURE_CATALOG.map((f) => [f.key, typeof planFeatures[f.key] === 'boolean' ? planFeatures[f.key]! : (FEATURE_DEFAULTS[f.key] ?? false)]),
  );
  const brandingProps = {
    appName: t.branding?.appName ?? '',
    logoUrl: t.branding?.logoUrl ?? '',
    customDomain: t.branding?.customDomain ?? '',
    poweredBy: t.branding?.poweredBy ?? true,
  };

  let planDisplay = sub?.plan.name ?? t.plan;
  if (sub?.customPriceMonthlyPaise !== null && sub?.customPriceMonthlyPaise !== undefined) {
    planDisplay = `${planDisplay} (Custom: ₹${(sub.customPriceMonthlyPaise / 100).toLocaleString('en-IN')}/mo)`;
  } else if (sub?.customPriceYearlyPaise !== null && sub?.customPriceYearlyPaise !== undefined) {
    planDisplay = `${planDisplay} (Custom: ₹${(sub.customPriceYearlyPaise / 100).toLocaleString('en-IN')}/yr)`;
  }

  const facts = [
    ['Subdomain', `${t.subdomain ?? '—'}.chayaone.com`],
    ['Plan', planDisplay],
    ['Subscription', sub?.status ?? '—'],
    ['Billing period', sub?.period ?? '—'],
    ['Trial ends', fmtDate(sub?.trialEndsAt)],
    ['Current period ends', fmtDate(sub?.currentEnd)],
    ['Created', fmtDate(t.createdAt)],
  ];

  const meters = [
    ['Branches', usage.branches ?? t._count.outlets, sub?.plan.maxBranches],
    ['Staff', usage.staff ?? t._count.staff, sub?.plan.maxStaff],
    ['Customers', usage.customers ?? t._count.customers, sub?.plan.maxCustomers],
  ] as const;

  return (
    <main className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center gap-3">
          <Link href="/admin/tenants" className="text-sm" style={{ color: 'var(--ink-3)' }}>← Tenants</Link>
          <div>
            <h1 className="font-display text-2xl leading-none">{t.name}</h1>
            <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--ink-3)' }}>status: {t.status}</p>
          </div>
        </div>
        <TenantActions id={t.id} status={t.status} />
      </header>

      <section className="p-6 grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="lux-card p-5">
          <h2 className="font-display text-xl mb-3">Overview</h2>
          <dl className="space-y-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <dt style={{ color: 'var(--ink-3)' }}>{k}</dt>
                <dd className="font-bold capitalize">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lux-card p-5">
          <h2 className="font-display text-xl mb-3">Usage vs plan</h2>
          <div className="space-y-3">
            {meters.map(([label, used, limit]) => {
              const cap = limit == null ? null : Number(limit);
              const pct = cap ? Math.min(100, Math.round((Number(used) / cap) * 100)) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--ink-2)' }}>{label}</span>
                    <span className="font-bold">{String(used)} / {cap ?? '∞'}</span>
                  </div>
                  <div className="h-2 rounded-full mt-1" style={{ background: 'var(--paper-3)' }}>
                    <div className="h-2 rounded-full" style={{ width: `${cap ? pct : 6}%`, background: pct >= 90 ? 'var(--danger)' : 'var(--gold)' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs mt-4" style={{ color: 'var(--ink-3)' }}>
            Slots are enforced at write time; blank override falls back to the plan limit.
          </p>
        </div>

        <TenantSettings
          id={t.id}
          branding={brandingProps}
          slots={{ maxBranches: slotStr('maxBranches'), maxStaff: slotStr('maxStaff'), maxCustomers: slotStr('maxCustomers') }}
        />

        <TenantSubscription
          id={t.id}
          sub={subProps}
        />

        <TenantPayment
          id={t.id}
          customPaymentEnabled={t.customPaymentEnabled}
          razorpayKeyId={t.razorpayKeyId ?? ''}
          razorpayKeySecret={t.razorpayKeySecret ?? ''}
        />

        <FeatureAccess
          id={t.id}
          catalog={FEATURE_CATALOG}
          inherited={inheritedFeatures}
          overrides={featureOverrides}
        />
      </section>
    </main>
  );
}
