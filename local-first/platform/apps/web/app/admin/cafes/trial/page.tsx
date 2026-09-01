import { listTenants } from '@/lib/platform-tenants';
import { CafeList } from '../CafeList';
import { PageHeader } from '@/components/ui/PageHeader';

export default async function TrialCafesPage() {
  const tenants = await listTenants();
  const trialing = tenants.filter(t => t.status === 'trialing');
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <PageHeader title="Trial Cafes" />
      <CafeList initialTenants={trialing} />
    </div>
  );
}
