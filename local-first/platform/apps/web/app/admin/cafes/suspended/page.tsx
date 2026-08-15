import { listTenants } from '@/lib/platform-tenants';
import { CafeList } from '../CafeList';

export default async function SuspendedCafesPage() {
  const tenants = await listTenants();
  const suspended = tenants.filter(t => t.status === 'suspended');
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Suspended Cafes</h1>
      </header>
      <CafeList initialTenants={suspended} />
    </div>
  );
}
