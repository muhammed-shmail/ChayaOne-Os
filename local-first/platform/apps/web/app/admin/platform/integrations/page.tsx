import { Puzzle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

export default function IntegrationsPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <PageHeader title="Platform Integrations" description="Configure system-wide 3rd party APIs." />
      <div className="lux-card card-glow p-8 bg-[var(--paper-2)]">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--line)]">
          <Puzzle size={32} className="text-[var(--gold)]" />
          <div>
            <h2 className="font-bold text-lg">Razorpay Master Gateway</h2>
            <p className="text-xs text-[var(--ink-3)]">Handles platform subscriptions and default tenant payments.</p>
          </div>
          <button className="ml-auto btn btn-ghost border border-[var(--line)]">Configure</button>
        </div>
        
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--line)]">
          <Puzzle size={32} className="text-[var(--gold)]" />
          <div>
            <h2 className="font-bold text-lg">WhatsApp API (Meta)</h2>
            <p className="text-xs text-[var(--ink-3)]">Global WhatsApp Business account for sending OTPs and KOTs.</p>
          </div>
          <button className="ml-auto btn btn-ghost border border-[var(--line)]">Configure</button>
        </div>
      </div>
    </div>
  );
}
