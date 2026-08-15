'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PlanEditor({ initialPlans }: { initialPlans: any[] }) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [monthlyPrice, setMonthlyPrice] = useState('0');
  const [yearlyPrice, setYearlyPrice] = useState('0');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const inputStyle = { background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)' } as const;

  const startEditing = (plan: any) => {
    setEditingKey(plan.key);
    const prices = (plan.pricePaise ?? {}) as { monthly?: number; yearly?: number };
    setMonthlyPrice(String((prices.monthly ?? 0) / 100));
    setYearlyPrice(String((prices.yearly ?? 0) / 100));
    setMsg('');
  };

  const cancelEditing = () => {
    setEditingKey(null);
  };

  const savePricing = async (planKey: string) => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planKey,
          priceMonthly: parseFloat(monthlyPrice) || 0,
          priceYearly: parseFloat(yearlyPrice) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.plan) {
        setPlans(prev => prev.map(p => p.key === planKey ? data.plan : p));
        setEditingKey(null);
        setMsg('Plan pricing updated ✓');
        router.refresh();
      } else {
        setMsg('Could not update pricing');
      }
    } catch {
      setMsg('Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lux-card p-6 mt-6">
      <h2 className="font-display text-xl mb-1">Global Subscription Plans &amp; Fees</h2>
      <p className="text-xs text-ink-3 mb-4">Edit the monthly and annual pricing for platform plans. These values apply immediately to all new billing invoice calculations.</p>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }} className="text-xs uppercase font-bold border-b border-line">
              <th className="px-4 py-2">Plan Name</th>
              <th className="px-4 py-2">Monthly Fee (₹)</th>
              <th className="px-4 py-2">Yearly Fee (₹)</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => {
              const prices = (p.pricePaise ?? {}) as { monthly?: number; yearly?: number };
              const isEditing = editingKey === p.key;

              return (
                <tr key={p.key} className="border-t transition-colors hover:bg-[var(--paper-3)]" style={{ borderColor: 'var(--line)' }}>
                  <td className="px-4 py-3 font-bold capitalize">
                    {p.name}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input type="number" step="0.01" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} className="w-24 rounded px-2 py-1 text-sm outline-none" style={inputStyle} aria-label="Monthly Fee" />
                    ) : (
                      <span className="font-mono">₹{((prices.monthly ?? 0) / 100).toLocaleString('en-IN')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input type="number" step="0.01" value={yearlyPrice} onChange={(e) => setYearlyPrice(e.target.value)} className="w-24 rounded px-2 py-1 text-sm outline-none" style={inputStyle} aria-label="Yearly Fee" />
                    ) : (
                      <span className="font-mono">₹{((prices.yearly ?? 0) / 100).toLocaleString('en-IN')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelEditing} disabled={busy} className="btn py-1 px-2.5 text-xs">Cancel</button>
                        <button onClick={() => savePricing(p.key)} disabled={busy} className="btn btn-lux py-1 px-2.5 text-xs">Save</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(p)} className="text-sm font-bold" style={{ color: 'var(--gold-d)' }}>Edit Fees</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {msg && <p className="text-sm font-bold text-center mt-3" style={{ color: 'var(--ink-2)' }}>{msg}</p>}
    </div>
  );
}
