import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform-session';
import { listTenants } from '@/lib/platform-tenants';
import { NewTenant } from './NewTenant';
import { CafeList } from './CafeList';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function CafesPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const tenants = await listTenants();

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <PageHeader 
        title={
          <span className="flex items-center gap-3">
            Cafe Management
            <span className="text-lg font-medium text-[var(--gold-d)] bg-[var(--gold)]/10 px-3 py-1 rounded-full">{tenants.length}</span>
          </span>
        }
        description="View and manage all cafes across the platform."
      >
        <NewTenant />
      </PageHeader>

      <section className="flex-1">
        <CafeList initialTenants={tenants} />
      </section>
    </div>
  );
}
