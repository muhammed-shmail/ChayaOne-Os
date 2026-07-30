'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TenantPayment({
  id,
  customPaymentEnabled,
  razorpayKeyId,
  razorpayKeySecret,
}: {
  id: string;
  customPaymentEnabled: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(customPaymentEnabled);
  const [keyId, setKeyId] = useState(razorpayKeyId);
  const [keySecret, setKeySecret] = useState(razorpayKeySecret);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const inputStyle = { background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)' } as const;

  async function savePayment() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/tenants/${id}/payment`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customPaymentEnabled: enabled,
          razorpayKeyId: keyId.trim() || null,
          razorpayKeySecret: keySecret.trim() || null,
        }),
      });
      setBusy(false);
      setMsg(res.ok ? 'Payment settings saved ✓' : 'Could not save payment settings');
      if (res.ok) router.refresh();
    } catch {
      setBusy(false);
      setMsg('Something went wrong');
    }
  }

  return (
    <div className="lux-card p-5">
      <h2 className="font-display text-xl mb-3">Custom Payment</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--ink-3)' }}>
        Configure tenant-specific Razorpay payment credentials. When enabled, customer QR payments will route directly to this account.
      </p>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm select-none cursor-pointer" style={{ color: 'var(--ink-2)' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded"
          />
          Enable Custom Gateway
        </label>

        <div className="space-y-2 pt-1">
          <label className="block text-xs font-bold" style={{ color: 'var(--ink-3)' }}>Razorpay Key ID</label>
          <input
            placeholder="rzp_live_..."
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            disabled={!enabled || busy}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none transition-opacity"
            style={{ ...inputStyle, opacity: enabled ? 1 : 0.6 }}
          />

          <label className="block text-xs font-bold pt-1" style={{ color: 'var(--ink-3)' }}>Razorpay Key Secret</label>
          <input
            type="password"
            placeholder="••••••••••••••••••••••••"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            disabled={!enabled || busy}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none transition-opacity"
            style={{ ...inputStyle, opacity: enabled ? 1 : 0.6 }}
          />
        </div>

        <button
          onClick={savePayment}
          disabled={busy}
          className="btn btn-lux w-full mt-2"
          style={{ padding: 10, borderRadius: 12 }}
        >
          {busy ? 'Saving...' : 'Save payment settings'}
        </button>

        {msg && <p className="text-sm font-bold text-center mt-2" style={{ color: 'var(--ink-2)' }}>{msg}</p>}
      </div>
    </div>
  );
}
