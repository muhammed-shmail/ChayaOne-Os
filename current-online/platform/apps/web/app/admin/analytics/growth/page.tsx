import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import { TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function GrowthAnalyticsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const tenantCount = await prisma.tenant.count();
  const byStatus = await prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Growth Analytics</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Track tenant acquisition and retention.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="lux-card card-glow p-6">
          <TrendingUp size={24} className="text-[var(--gold)] mb-4" />
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Total Tenants</p>
          <div className="font-display text-3xl mt-2">{tenantCount}</div>
        </div>
        
        {byStatus.map((st) => (
          <div key={st.status} className="lux-card card-glow p-6">
            <TrendingUp size={24} className="text-[var(--ink-3)] mb-4" />
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">{st.status} Tenants</p>
            <div className="font-display text-3xl mt-2">{st._count._all}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
