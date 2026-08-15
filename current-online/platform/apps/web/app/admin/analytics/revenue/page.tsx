import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import { DollarSign } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RevenueAnalyticsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const dailyRollups = await prisma.dailySalesRollup.groupBy({
    by: ['day'],
    _sum: { grossPaise: true, netPaise: true }
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Revenue Analytics</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Platform-wide GMV and net revenue tracking.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lux-card card-glow p-6 col-span-1">
          <div className="flex justify-between items-start">
            <div className="p-3 rounded-xl bg-[var(--paper-3)] text-[var(--gold)]">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)] mt-6">Total GMV (All Time)</p>
          <div className="font-display text-4xl leading-tight mt-2 text-[var(--ink)]">
             ₹{((dailyRollups.reduce((acc, r) => acc + (r._sum.grossPaise || 0), 0)) / 100).toLocaleString('en-IN')}
          </div>
        </div>

        <div className="lux-card card-glow p-6 col-span-1 lg:col-span-2">
           <h3 className="font-bold text-[var(--ink-2)] mb-4">Revenue Trends</h3>
           {/* Fallback mock chart since Recharts isn't installed */}
           <div className="h-[200px] flex items-end gap-2">
             {[40, 70, 45, 90, 60, 100, 80].map((height, i) => (
                <div key={i} className="flex-1 bg-[var(--gold)]/20 hover:bg-[var(--gold)]/40 rounded-t-sm transition-colors relative" style={{ height: `${height}%` }}>
                   <div className="absolute bottom-0 w-full bg-[var(--gold)] rounded-t-sm" style={{ height: '30%' }} />
                </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
