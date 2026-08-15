import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import { CheckCircle, XCircle, Edit2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const plans = await prisma.planDefinition.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Subscription Plans</h1>
          <p className="text-sm mt-2 text-[var(--ink-3)]">Manage platform tiers and feature limits.</p>
        </div>
        <button className="btn btn-primary bg-[var(--gold)] text-[#2A1607] hover:bg-[var(--gold-d)]">Create Plan</button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map((p) => {
          const prices = p.pricePaise as any || {};
          const features = p.features as any || {};
          return (
            <div key={p.id} className="lux-card card-glow flex flex-col h-full bg-[var(--paper-2)] relative">
              {!p.active && (
                <div className="absolute top-0 right-0 bg-[var(--danger)] text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">Inactive</div>
              )}
              <div className="p-6 border-b border-[var(--line)]">
                <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-[var(--gold-d)] mb-2">{p.name}</h3>
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-3xl font-bold">?{((prices.monthly || 0) / 100).toLocaleString()}</span>
                  <span className="text-[var(--ink-3)] mb-1">/ mo</span>
                </div>
                <button className="w-full py-2 rounded-lg border border-[var(--line)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/10 transition-colors flex items-center justify-center gap-2 font-semibold text-sm">
                  <Edit2 size={16} /> Edit Plan
                </button>
              </div>
              <div className="p-6 flex-1 space-y-4 text-sm">
                <div className="flex justify-between border-b border-[var(--line-2)] pb-2">
                  <span className="text-[var(--ink-3)]">Branches</span>
                  <span className="font-bold">{p.maxBranches ?? 'Unlimited'}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--line-2)] pb-2">
                  <span className="text-[var(--ink-3)]">Staff Users</span>
                  <span className="font-bold">{p.maxStaff ?? 'Unlimited'}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--line-2)] pb-2">
                  <span className="text-[var(--ink-3)]">Customers</span>
                  <span className="font-bold">{p.maxCustomers ?? 'Unlimited'}</span>
                </div>
                {Object.entries(features).slice(0, 5).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-[var(--ink-3)] capitalize">{key.replace('_', ' ')}</span>
                    {val ? <CheckCircle size={16} className="text-[var(--ok)]" /> : <XCircle size={16} className="text-[var(--danger)]" />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
