'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeatureDef } from '@/lib/feature-catalog';

type TriState = 'inherit' | 'on' | 'off';

/**
 * Per-cafe Feature Access — the "tick model". Each catalogue feature is a
 * tri-state: Inherit (use the plan default), Force ON, or Force OFF. Only
 * On/Off keys are sent; Inherit keys are omitted so the saved override map
 * replaces entirely (same semantics as slot overrides).
 */
export function FeatureAccess({
  id,
  catalog,
  inherited,
  overrides,
}: {
  id: string;
  catalog: FeatureDef[];
  inherited: Record<string, boolean>; // effective flag ignoring overrides (plan ?? catalogue default)
  overrides: Record<string, boolean>; // current per-cafe overrides
}) {
  const router = useRouter();
  const initial: Record<string, TriState> = Object.fromEntries(
    catalog.map((f) => [f.key, f.key in overrides ? (overrides[f.key] ? 'on' : 'off') : 'inherit']),
  );
  const [state, setState] = useState<Record<string, TriState>>(initial);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const categories = Array.from(new Set(catalog.map((f) => f.category)));

  async function save() {
    setBusy(true);
    setMsg('');
    const featureOverrides: Record<string, boolean> = {};
    for (const f of catalog) {
      const v = state[f.key];
      if (v === 'on') featureOverrides[f.key] = true;
      else if (v === 'off') featureOverrides[f.key] = false;
      // 'inherit' → omit (falls back to plan / catalogue default)
    }
    const res = await fetch(`/api/admin/tenants/${id}/features`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ featureOverrides }),
    });
    setBusy(false);
    setMsg(res.ok ? 'Feature access saved ✓' : 'Could not save features');
    if (res.ok) router.refresh();
  }

  return (
    <div className="lux-card p-5" style={{ gridColumn: '1 / -1' }}>
      <h2 className="font-display text-xl mb-1">Feature access</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--ink-3)' }}>
        Tick which modules this cafe gets. <b>Inherit</b> follows the plan default; <b>On</b>/<b>Off</b> override it for this cafe only.
      </p>

      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat}>
            <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--ink-3)' }}>{cat}</p>
            <div className="space-y-2">
              {catalog.filter((f) => f.category === cat).map((f) => {
                const cur = state[f.key] ?? 'inherit';
                const planOn = inherited[f.key];
                return (
                  <div key={f.key} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{f.label}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>
                        {cur === 'inherit' ? `Plan default: ${planOn ? 'On' : 'Off'}` : f.description}
                      </div>
                    </div>
                    <TriToggle value={cur} onChange={(v) => setState({ ...state, [f.key]: v })} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={save} disabled={busy} className="btn btn-lux" style={{ padding: '10px 18px', borderRadius: 12 }}>
          Save feature access
        </button>
        {msg && <span className="text-sm font-bold" style={{ color: 'var(--ink-2)' }}>{msg}</span>}
      </div>
    </div>
  );
}

function TriToggle({ value, onChange }: { value: TriState; onChange: (v: TriState) => void }) {
  const opts: { v: TriState; label: string }[] = [
    { v: 'inherit', label: 'Inherit' },
    { v: 'on', label: 'On' },
    { v: 'off', label: 'Off' },
  ];
  const tint = (v: TriState) =>
    v === 'on' ? 'var(--ok, #1a7f37)' : v === 'off' ? 'var(--danger)' : 'var(--ink-2)';
  return (
    <div className="flex shrink-0 rounded-lg overflow-hidden" style={{ border: '1px solid var(--line)' }}>
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className="px-3 py-1.5 text-xs font-bold transition-colors"
            style={{
              background: active ? 'var(--paper-3)' : 'transparent',
              color: active ? tint(o.v) : 'var(--ink-3)',
              borderLeft: o.v !== 'inherit' ? '1px solid var(--line)' : 'none',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
