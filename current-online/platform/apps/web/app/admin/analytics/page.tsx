import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform-session';
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold flex items-center gap-3">
          <BarChart3 size={28} className="text-[var(--gold)]" />
          Analytics
        </h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Platform-wide insights and performance metrics.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="lux-card card-glow p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[var(--paper-3)] rounded-lg text-[var(--gold-d)]"><DollarSign size={20} /></div>
            <h3 className="font-bold">Revenue Growth</h3>
          </div>
          <div className="font-display text-3xl">₹1,24,500</div>
          <p className="text-xs text-[var(--ok)] font-bold mt-1">+14.5% vs last month</p>
        </div>
        
        <div className="lux-card card-glow p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[var(--paper-3)] rounded-lg text-[var(--gold-d)]"><TrendingUp size={20} /></div>
            <h3 className="font-bold">Total Orders</h3>
          </div>
          <div className="font-display text-3xl">45,280</div>
          <p className="text-xs text-[var(--ok)] font-bold mt-1">+8.2% vs last month</p>
        </div>

        <div className="lux-card card-glow p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[var(--paper-3)] rounded-lg text-[var(--gold-d)]"><Users size={20} /></div>
            <h3 className="font-bold">Active Customers</h3>
          </div>
          <div className="font-display text-3xl">12,400</div>
          <p className="text-xs text-[var(--danger)] font-bold mt-1">-2.1% vs last month</p>
        </div>
      </section>

      <section className="lux-card card-glow flex-1 min-h-[400px] p-6 flex flex-col items-center justify-center text-center">
        <BarChart3 size={48} className="text-[var(--ink-3)] mb-4" />
        <h2 className="text-xl font-bold text-[var(--ink)]">Detailed Reports coming soon</h2>
        <p className="text-sm text-[var(--ink-3)] mt-2 max-w-md">
          Advanced analytics including cohort analysis, churn rates, and state-wise performance are currently being generated.
        </p>
      </section>
    </div>
  );
}
