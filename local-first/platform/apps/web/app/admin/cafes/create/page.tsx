import { NewTenant } from '../NewTenant';
import { PageHeader } from '@/components/ui/PageHeader';

export default function CreateCafePage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <PageHeader title="Create Cafe" />
      <div className="lux-card card-glow p-8 bg-[var(--paper-2)]">
        <NewTenant />
      </div>
    </div>
  );
}
