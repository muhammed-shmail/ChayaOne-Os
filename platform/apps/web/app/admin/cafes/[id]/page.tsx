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
import { Building2, User, CreditCard, Layers, ShieldCheck, CreditCard as PaymentIcon, Settings2, ShieldBan, MapPin, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default async function CafeProfile({ params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.id)) {
    notFound();
  }

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

  // Feature access (tick model)
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

  const statusColor = t.status === 'active' ? 'var(--ok)' : t.status === 'suspended' ? 'var(--warn)' : 'var(--danger)';

  return (
    <div className="min-h-screen pb-12" style={{ background: 'var(--paper)' }}>
      {/* Profile Header */}
      <div className="bg-[var(--paper-2)] border-b border-[var(--line)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/cafes" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--paper-3)] transition-colors text-[var(--ink-3)]">
              ←
            </Link>
            <div className="w-12 h-12 rounded-xl bg-[var(--paper-3)] border border-[var(--line)] flex items-center justify-center font-display text-2xl text-[var(--gold-d)]">
              {t.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-bold leading-none">{t.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border" style={{ borderColor: statusColor, color: statusColor, background: `color-mix(in srgb, ${statusColor} 10%, transparent)` }}>
                  {t.status}
                </span>
              </div>
              <div className="text-sm mt-1 text-[var(--ink-3)] font-medium flex items-center gap-2">
                <span>{t.subdomain ?? '—'}.chayaone.com</span>
                <span>•</span>
                <span>Created {fmtDate(t.createdAt)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <TenantActions id={t.id} status={t.status} />
          </div>
        </div>
        
        {/* Profile Tabs */}
        <div className="max-w-[1600px] mx-auto px-6 mt-2 flex gap-6 overflow-x-auto no-scrollbar border-t border-[var(--line-2)] pt-2">
          {['Overview', 'Branches', 'Subscription', 'Services', 'White Label', 'Settings'].map((tab, i) => (
            <button key={tab} className={`px-2 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${i === 0 ? 'border-[var(--gold)] text-[var(--gold-d)]' : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 pt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN - Overview */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* Business Overview */}
          <div className="lux-card card-glow p-5">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-[var(--gold)]" />
              Business Overview
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm py-2 border-b border-[var(--line-2)]">
                <span className="text-[var(--ink-3)] font-medium">GSTIN</span>
                <span className="font-bold">Not provided</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-[var(--line-2)]">
                <span className="text-[var(--ink-3)] font-medium">Business Type</span>
                <span className="font-bold">Cafe</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-[var(--line-2)]">
                <span className="text-[var(--ink-3)] font-medium">Timezone</span>
                <span className="font-bold">Asia/Kolkata</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-[var(--line-2)]">
                <span className="text-[var(--ink-3)] font-medium">Currency</span>
                <span className="font-bold">INR (₹)</span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-[var(--ink-3)] font-medium">Language</span>
                <span className="font-bold">English</span>
              </div>
            </div>
          </div>

          {/* Owner Information */}
          <div className="lux-card card-glow p-5">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <User size={18} className="text-[var(--gold)]" />
              Owner Information
            </h2>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-[var(--paper-3)] border border-[var(--line)] flex items-center justify-center">
                <User size={20} className="text-[var(--ink-3)]" />
              </div>
              <div>
                <p className="font-bold text-[var(--ink)]">Owner Name</p>
                <p className="text-xs text-[var(--ok)] font-bold mt-0.5 flex items-center gap-1"><ShieldCheck size={12}/> Verified</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
               <div className="flex justify-between py-1 border-b border-[var(--line-2)]">
                <span className="text-[var(--ink-3)] font-medium">Phone</span>
                <span className="font-bold">+91 98765 43210</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--line-2)]">
                <span className="text-[var(--ink-3)] font-medium">Email</span>
                <span className="font-bold">owner@example.com</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--ink-3)] font-medium">Last Login</span>
                <span className="font-bold">Today, 10:42 AM</span>
              </div>
            </div>
          </div>

          {/* License Usage (Progress Bars) */}
          <div className="lux-card card-glow p-5">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <Layers size={18} className="text-[var(--gold)]" />
              License Usage
            </h2>
            <div className="space-y-5">
              {[
                ['Branches', usage.branches ?? t._count.outlets, sub?.plan.maxBranches],
                ['Staff', usage.staff ?? t._count.staff, sub?.plan.maxStaff],
                ['Customers', usage.customers ?? t._count.customers, sub?.plan.maxCustomers],
              ].map(([label, used, limit]) => {
                const cap = limit == null ? null : Number(limit);
                const pct = cap ? Math.min(100, Math.round((Number(used) / cap) * 100)) : 0;
                return (
                  <div key={label.toString()}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-semibold text-[var(--ink-2)]">{label}</span>
                      <span className="font-bold text-[var(--ink)]">{String(used)} <span className="text-[var(--ink-3)]">/ {cap ?? '∞'}</span></span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-[var(--paper-3)]">
                      <div className="h-full transition-all duration-500" style={{ width: `${cap ? pct : 6}%`, background: pct >= 90 ? 'var(--danger)' : 'var(--gold)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* RIGHT COLUMN - Main Content */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Subscription Management */}
          <div className="lux-card card-glow overflow-hidden">
            <div className="p-5 border-b border-[var(--line)] flex justify-between items-center">
              <h2 className="font-display text-xl flex items-center gap-2">
                <CreditCard size={18} className="text-[var(--gold)]" />
                Subscription Management
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-[var(--ok-bg)] text-[var(--ok-ink)] border border-[var(--ok)]/30">
                {sub?.status ?? 'Active'}
              </span>
            </div>
            
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--paper-3)] border-b border-[var(--line)]">
              <div>
                <p className="text-xs font-bold uppercase text-[var(--ink-3)] tracking-wider mb-1">Current Plan</p>
                <p className="font-bold text-lg">{planDisplay}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[var(--ink-3)] tracking-wider mb-1">Billing Cycle</p>
                <p className="font-bold text-lg capitalize">{sub?.period ?? 'Monthly'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[var(--ink-3)] tracking-wider mb-1">Renewal Date</p>
                <p className="font-bold text-lg">{fmtDate(sub?.currentEnd)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[var(--ink-3)] tracking-wider mb-1">Auto Renewal</p>
                <p className="font-bold text-lg text-[var(--ok)]">Enabled</p>
              </div>
            </div>
            
            <div className="p-5">
               <TenantSubscription id={t.id} sub={subProps} />
            </div>
          </div>

          {/* Branches Table */}
          <div className="lux-card card-glow overflow-hidden flex flex-col">
            <div className="p-5 border-b border-[var(--line)] flex justify-between items-center">
              <h2 className="font-display text-xl flex items-center gap-2">
                <MapPin size={18} className="text-[var(--gold)]" />
                Branches ({t._count.outlets})
              </h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" size={14} />
                <input type="text" placeholder="Search branches..." className="inp h-8 pl-8 text-xs focus:ring-[var(--gold)] w-[200px]" />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-3)] text-[var(--ink-3)] text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Branch Name</th>
                  <th className="px-5 py-3 text-left font-semibold">Manager</th>
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                  <th className="px-5 py-3 text-left font-semibold">Devices</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">
                  <td className="px-5 py-4 font-bold">Main Branch</td>
                  <td className="px-5 py-4 text-[var(--ink-2)]">Raj Kumar</td>
                  <td className="px-5 py-4"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--ok-bg)] text-[var(--ok-ink)]">Active</span></td>
                  <td className="px-5 py-4 text-[var(--ink-2)] font-medium">3 POS · 1 KDS</td>
                  <td className="px-5 py-4 text-right"><Link href="#" className="text-[var(--gold-d)] font-bold text-xs hover:underline">View Details</Link></td>
                </tr>
                {t._count.outlets > 1 && (
                  <tr className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">
                    <td className="px-5 py-4 font-bold">Downtown</td>
                    <td className="px-5 py-4 text-[var(--ink-2)]">Anjali Sharma</td>
                    <td className="px-5 py-4"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--ok-bg)] text-[var(--ok-ink)]">Active</span></td>
                    <td className="px-5 py-4 text-[var(--ink-2)] font-medium">2 POS</td>
                    <td className="px-5 py-4 text-right"><Link href="#" className="text-[var(--gold-d)] font-bold text-xs hover:underline">View Details</Link></td>
                  </tr>
                )}
                {t._count.outlets === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--ink-3)]">No branches found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Legacy Components wrapped in new styling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="lux-card card-glow p-5">
              <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                <Settings2 size={18} className="text-[var(--gold)]" />
                Settings & White Label
              </h2>
              <TenantSettings
                id={t.id}
                branding={brandingProps}
                slots={{ maxBranches: slotStr('maxBranches'), maxStaff: slotStr('maxStaff'), maxCustomers: slotStr('maxCustomers') }}
              />
            </div>
            
            <div className="lux-card card-glow p-5">
              <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                <PaymentIcon size={18} className="text-[var(--gold)]" />
                Payment Gateway
              </h2>
              <TenantPayment
                id={t.id}
                customPaymentEnabled={t.customPaymentEnabled}
                razorpayKeyId={t.razorpayKeyId ?? ''}
                razorpayKeySecret={t.razorpayKeySecret ?? ''}
              />
            </div>
          </div>

          <div className="lux-card card-glow p-5">
             <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[var(--gold)]" />
              Services & Features
            </h2>
            <FeatureAccess
              id={t.id}
              catalog={FEATURE_CATALOG}
              inherited={inheritedFeatures}
              overrides={featureOverrides}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
