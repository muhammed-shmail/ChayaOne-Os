import { Activity, Database, Cloud, Server } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

export default function HealthPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <PageHeader title="Platform Health" description="Real-time status of critical infrastructure." />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="lux-card card-glow p-6 flex flex-col">
           <div className="flex justify-between items-center mb-4">
             <Database size={24} className="text-[var(--gold)]" />
             <div className="w-2 h-2 rounded-full bg-[var(--ok)] animate-pulse shadow-[0_0_8px_var(--ok)]" />
           </div>
           <h3 className="font-bold text-lg">Postgres DB</h3>
           <p className="text-xs text-[var(--ink-3)] mb-4">AWS RDS instances</p>
           <div className="mt-auto flex justify-between items-end border-t border-[var(--line-2)] pt-2">
             <span className="text-[var(--ink-2)] text-xs">Latency</span>
             <span className="font-mono text-[var(--ok)]">12ms</span>
           </div>
        </div>

        <div className="lux-card card-glow p-6 flex flex-col">
           <div className="flex justify-between items-center mb-4">
             <Server size={24} className="text-[var(--gold)]" />
             <div className="w-2 h-2 rounded-full bg-[var(--ok)] animate-pulse shadow-[0_0_8px_var(--ok)]" />
           </div>
           <h3 className="font-bold text-lg">Redis Cache</h3>
           <p className="text-xs text-[var(--ink-3)] mb-4">ElastiCache cluster</p>
           <div className="mt-auto flex justify-between items-end border-t border-[var(--line-2)] pt-2">
             <span className="text-[var(--ink-2)] text-xs">Latency</span>
             <span className="font-mono text-[var(--ok)]">2ms</span>
           </div>
        </div>
        
        <div className="lux-card card-glow p-6 flex flex-col">
           <div className="flex justify-between items-center mb-4">
             <Cloud size={24} className="text-[var(--gold)]" />
             <div className="w-2 h-2 rounded-full bg-[var(--ok)] animate-pulse shadow-[0_0_8px_var(--ok)]" />
           </div>
           <h3 className="font-bold text-lg">Vercel Edge</h3>
           <p className="text-xs text-[var(--ink-3)] mb-4">Global CDN & API Routes</p>
           <div className="mt-auto flex justify-between items-end border-t border-[var(--line-2)] pt-2">
             <span className="text-[var(--ink-2)] text-xs">Status</span>
             <span className="font-mono text-[var(--ok)]">Operational</span>
           </div>
        </div>

        <div className="lux-card card-glow p-6 flex flex-col">
           <div className="flex justify-between items-center mb-4">
             <Activity size={24} className="text-[var(--warn)]" />
             <div className="w-2 h-2 rounded-full bg-[var(--warn)] animate-pulse shadow-[0_0_8px_var(--warn)]" />
           </div>
           <h3 className="font-bold text-lg">Background Workers</h3>
           <p className="text-xs text-[var(--ink-3)] mb-4">BullMQ processing queues</p>
           <div className="mt-auto flex justify-between items-end border-t border-[var(--line-2)] pt-2">
             <span className="text-[var(--ink-2)] text-xs">Backlog</span>
             <span className="font-mono text-[var(--warn)]">42 jobs</span>
           </div>
        </div>
      </div>
    </div>
  );
}
