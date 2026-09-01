import { listTenants } from '@/lib/platform-tenants';
import { CafeList } from '../CafeList';
import { PageHeader } from '@/components/ui/PageHeader';

export default async function SuspendedCafesPage() {
  const tenants = await listTenants();
  const suspended = tenants.filter(t => t.status === 'suspended');
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <PageHeader title="Suspended Cafes" />
      <CafeList initialTenants={suspended} />
    </div>
  );
}
