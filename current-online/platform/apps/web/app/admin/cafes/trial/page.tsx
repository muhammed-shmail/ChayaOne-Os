import { listTenants } from '@/lib/platform-tenants';
import { CafeList } from '../CafeList';

export default async function TrialCafesPage() {
  const tenants = await listTenants();
  const trialing = tenants.filter(t => t.status === 'trialing');
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Trial Cafes</h1>
      </header>
      <CafeList initialTenants={trialing} />
    </div>
  );
}
