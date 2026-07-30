import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OrdersAnalyticsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const orderCount = await prisma.order.count();
  const byChannel = await prisma.order.groupBy({ by: ['channel'], _count: { _all: true } });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Order Analytics</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Platform-wide order volume and channels.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="lux-card card-glow p-6">
          <ShoppingBag size={24} className="text-[var(--gold)] mb-4" />
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Total Orders Processed</p>
          <div className="font-display text-3xl mt-2">{orderCount.toLocaleString()}</div>
        </div>

        {byChannel.map((c) => (
          <div key={c.channel} className="lux-card card-glow p-6">
            <ShoppingBag size={24} className="text-[var(--ink-3)] mb-4" />
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Channel: {c.channel.toUpperCase()}</p>
            <div className="font-display text-3xl mt-2">{c._count._all.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
