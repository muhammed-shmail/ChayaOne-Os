'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Owner dashboard panel (Staff PWA P5): live staff presence + logged-in devices,
 * with remote logout for a lost/stolen phone. Presence comes from
 * StaffSession.lastSeenAt (kept fresh by the staff app's keep-alive); revoking a
 * device sets revokedAt, which the refresh endpoint enforces within one access
 * token TTL (≤30 min).
 */
type Device = { id: string; label: string | null; lastSeenMs: number; createdMs: number; online: boolean; current: boolean };
type StaffPresence = { staffId: string; name: string; role: string; online: boolean; lastSeenMs: number; devices: Device[] };

function ago(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StaffDevices() {
  const [staff, setStaff] = useState<StaffPresence[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/devices', { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setStaff(d.staff ?? []); setOnlineCount(d.onlineCount ?? 0); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000); // live-ish presence
    return () => window.clearInterval(id);
  }, [load]);

  const revoke = async (device: Device, name: string) => {
    if (!window.confirm(`Log out ${name}'s device "${device.label ?? 'Unknown'}"? They'll need to sign in again.`)) return;
    setBusyId(device.id);
    try {
      const res = await fetch('/api/staff/devices', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'revoke', sessionId: device.id }),
      });
      if (res.ok) await load();
    } catch { /* ignore */ } finally { setBusyId(null); }
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold">Staff devices &amp; presence</h4>
        <span className="text-xs font-bold" style={{ color: 'var(--ink-3)' }}>
          {onlineCount} online
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-ink-3">Loading…</p>
      ) : staff.length === 0 ? (
        <p className="text-sm text-ink-3">No staff are signed in on a device right now.</p>
      ) : (
        <div className="grid gap-3">
          {staff.map((s) => (
            <div key={s.staffId} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.online ? 'var(--ok, #2E7D32)' : 'var(--ink-3, #9a9387)' }} aria-hidden />
                <span className="font-bold text-sm">{s.name}</span>
                <span className="pill text-[10px] capitalize" style={{ padding: '1px 8px' }}>{s.role}</span>
                <span className="ml-auto text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {s.online ? 'Online' : `Last seen ${ago(s.lastSeenMs)}`}
                </span>
              </div>
              <div className="mt-2 grid gap-1.5">
                {s.devices.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-[12.5px] pl-4">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.online ? 'var(--ok, #2E7D32)' : 'var(--ink-3, #9a9387)' }} aria-hidden />
                    <span className="font-medium">{d.label ?? 'Unknown device'}</span>
                    {d.current && <span className="text-[10px] font-bold" style={{ color: 'var(--turmeric-d)' }}>· this device</span>}
                    <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>· {ago(d.lastSeenMs)}</span>
                    {!d.current && (
                      <button
                        onClick={() => revoke(d, s.name)}
                        disabled={busyId === d.id}
                        className="ml-auto text-[11px] font-bold disabled:opacity-50"
                        style={{ color: 'var(--clay, #C3492F)' }}
                      >
                        {busyId === d.id ? '…' : 'Log out'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
