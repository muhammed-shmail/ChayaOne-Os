import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CustomersAnalyticsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const totalCustomers = await prisma.customer.count();

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Customer Analytics</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Platform-wide end-customer metrics.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="lux-card card-glow p-6">
          <Users size={24} className="text-[var(--gold)] mb-4" />
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Total Registered Customers</p>
          <div className="font-display text-3xl mt-2">{totalCustomers.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
