import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform-session';
import { listTenants } from '@/lib/platform-tenants';
import { NewTenant } from './NewTenant';
import { CafeList } from './CafeList';

export const dynamic = 'force-dynamic';

export default async function CafesPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const tenants = await listTenants();

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            Cafe Management
            <span className="text-lg font-medium text-[var(--gold-d)] bg-[var(--gold)]/10 px-3 py-1 rounded-full">{tenants.length}</span>
          </h1>
          <p className="text-sm mt-2 text-[var(--ink-3)]">View and manage all cafes across the platform.</p>
        </div>
        <NewTenant />
      </header>

      <section className="flex-1">
        <CafeList initialTenants={tenants} />
      </section>
    </div>
  );
}
