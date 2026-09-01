import { PageHeader } from '@/components/ui/PageHeader';
export default function Page() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <PageHeader title="settings" />
      <div className="lux-card card-glow p-8 bg-[var(--paper-2)] min-h-[400px] flex items-center justify-center">
        <p className="text-[var(--ink-3)] font-semibold">Content for settings coming soon.</p>
      </div>
    </div>
  );
}
