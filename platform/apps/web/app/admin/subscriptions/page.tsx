import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { CreditCard, FileText, CheckCircle, AlertTriangle, ArrowUpRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');

  // Fetch subscriptions
  const subscriptions = await prisma.subscription.findMany({
    include: {
      plan: true,
      tenant: { select: { name: true, subdomain: true, id: true } },
    },
    orderBy: { currentEnd: 'asc' }
  });

  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const pastDue = subscriptions.filter(s => s.status === 'past_due');
  const expired = subscriptions.filter(s => s.status === 'expired' || s.status === 'cancelled');

  let mrrPaise = 0;
  for (const sub of activeSubs) {
    if (sub.customPriceMonthlyPaise !== null && sub.customPriceMonthlyPaise !== undefined) {
      mrrPaise += sub.customPriceMonthlyPaise;
    } else {
      const pp = (sub.plan.pricePaise ?? {}) as { monthly?: number };
      mrrPaise += Number(pp.monthly ?? 0);
    }
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <CreditCard size={28} className="text-[var(--gold)]" />
            Subscriptions
          </h1>
          <p className="text-sm mt-2 text-[var(--ink-3)]">Manage billing, plans, and renewals across all cafes.</p>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="lux-card card-glow p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Active Subscriptions</p>
          <div className="font-display text-3xl mt-1">{activeSubs.length}</div>
        </div>
        <div className="lux-card card-glow p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">MRR</p>
          <div className="font-display text-3xl mt-1">₹{Math.round(mrrPaise / 100).toLocaleString('en-IN')}</div>
        </div>
        <div className="lux-card card-glow p-5 border-[var(--warn)]">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--warn-ink)] flex items-center gap-2">
            <AlertTriangle size={14} /> Past Due
          </p>
          <div className="font-display text-3xl mt-1 text-[var(--warn-ink)]">{pastDue.length}</div>
        </div>
        <div className="lux-card card-glow p-5 border-[var(--danger)]">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--danger-ink)]">Expired / Cancelled</p>
          <div className="font-display text-3xl mt-1 text-[var(--danger-ink)]">{expired.length}</div>
        </div>
      </section>

      {/* Subscriptions List */}
      <section className="lux-card card-glow flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] flex justify-between items-center bg-[var(--paper-2)]">
          <h2 className="font-display text-lg font-bold">All Subscriptions</h2>
          <div className="flex gap-2">
            <Link href="/admin/subscriptions/plans" className="btn btn-ghost btn-sm text-[var(--ink-2)]">Manage Plans</Link>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-3)] text-[var(--ink-3)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Cafe</th>
                <th className="px-5 py-3 text-left font-semibold">Plan</th>
                <th className="px-5 py-3 text-left font-semibold">Cycle</th>
                <th className="px-5 py-3 text-left font-semibold">Amount</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="px-5 py-3 text-left font-semibold">Renews / Expired</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => {
                const st = sub.status;
                const isWarning = st === 'past_due' || st === 'expired';
                
                let amt = 0;
                if (sub.period === 'monthly') {
                  amt = sub.customPriceMonthlyPaise ?? ((sub.plan.pricePaise as any)?.monthly ?? 0);
                } else {
                  amt = sub.customPriceYearlyPaise ?? ((sub.plan.pricePaise as any)?.yearly ?? 0);
                }

                return (
                  <tr key={sub.id} className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/admin/cafes/${sub.tenantId}`} className="font-bold text-[var(--ink)] hover:text-[var(--gold-d)]">
                        {sub.tenant.name}
                      </Link>
                      <div className="text-xs text-[var(--ink-3)]">{sub.tenant.subdomain}.chayaone.com</div>
                    </td>
                    <td className="px-5 py-4 font-semibold capitalize text-[var(--ink-2)]">{sub.plan.name}</td>
                    <td className="px-5 py-4 capitalize text-[var(--ink-2)]">{sub.period}</td>
                    <td className="px-5 py-4 font-medium">₹{Math.round(amt / 100).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        st === 'active' ? 'bg-[var(--ok-bg)] text-[var(--ok-ink)]' :
                        st === 'past_due' ? 'bg-[var(--warn-bg)] text-[var(--warn-ink)]' :
                        'bg-[var(--danger-bg)] text-[var(--danger-ink)]'
                      }`}>
                        {st.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[var(--ink-2)]">
                      {sub.currentEnd ? new Date(sub.currentEnd).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/admin/cafes/${sub.tenantId}`} className="text-xs font-bold text-[var(--gold-d)] hover:underline flex items-center justify-end gap-1">
                        View <ArrowUpRight size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[var(--ink-3)]">
                    No subscriptions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
