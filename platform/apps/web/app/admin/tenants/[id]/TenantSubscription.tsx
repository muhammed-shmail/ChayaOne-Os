'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TenantSubscription({
  id,
  sub,
}: {
  id: string;
  sub?: {
    planKey: string;
    period: string;
    status: string;
    currentEnd: string; // YYYY-MM-DD
  };
}) {
  const router = useRouter();
  const [planKey, setPlanKey] = useState(sub?.planKey ?? 'starter');
  const [period, setPeriod] = useState(sub?.period ?? 'monthly');
  const [status, setStatus] = useState(sub?.status ?? 'active');
  const [currentEnd, setCurrentEnd] = useState(sub?.currentEnd ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const input = { background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)' } as const;

  async function saveSubscription() {
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/admin/tenants/${id}/subscription`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        planKey,
        period,
        status,
        currentEnd: currentEnd || null,
      }),
    });
    setBusy(false);
    setMsg(res.ok ? 'Subscription updated ✓' : 'Could not update subscription');
    if (res.ok) router.refresh();
  }

  return (
    <div className="lux-card p-5">
      <h2 className="font-display text-xl mb-3">Manage Subscription</h2>
      <div className="space-y-3">
        <label className="flex items-center justify-between text-sm gap-2">
          <span style={{ color: 'var(--ink-2)' }}>Plan</span>
          <select value={planKey} onChange={(e) => setPlanKey(e.target.value)} className="w-40 rounded-lg px-2 py-1.5 text-sm outline-none" style={input} aria-label="Subscription Plan">
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>

        <label className="flex items-center justify-between text-sm gap-2">
          <span style={{ color: 'var(--ink-2)' }}>Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40 rounded-lg px-2 py-1.5 text-sm outline-none" style={input} aria-label="Billing Period">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="half_yearly">Half Yearly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>

        <label className="flex items-center justify-between text-sm gap-2">
          <span style={{ color: 'var(--ink-2)' }}>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40 rounded-lg px-2 py-1.5 text-sm outline-none" style={input} aria-label="Subscription Status">
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="past_due">Past Due</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </label>

        <label className="flex items-center justify-between text-sm gap-2">
          <span style={{ color: 'var(--ink-2)' }}>End Date</span>
          <input type="date" value={currentEnd} onChange={(e) => setCurrentEnd(e.target.value)} className="w-40 rounded-lg px-2 py-1.5 text-sm outline-none" style={input} aria-label="End Date" />
        </label>

        <button onClick={saveSubscription} disabled={busy} className="btn btn-lux w-full mt-2" style={{ padding: 10, borderRadius: 12 }}>
          Save Subscription
        </button>

        {msg && <p className="text-sm font-bold text-center mt-2" style={{ color: 'var(--ink-2)' }}>{msg}</p>}
      </div>
    </div>
  );
}
