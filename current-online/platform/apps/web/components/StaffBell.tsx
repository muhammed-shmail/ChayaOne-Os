'use client';

import { useState } from 'react';
import { Bell, X } from '@/components/ui';
import { useStaffFeed, markSeen, type FeedItem } from '@/components/staff-feed';

/**
 * Staff notification bell + panel. Drop into any staff header (POS mobile bar,
 * POS desktop rail, KDS bar). All instances share one feed (see staff-feed.ts),
 * so the unread badge stays consistent and only one SSE connection is used.
 */
const SEV_COLOR: Record<string, string> = { info: 'var(--turmeric, #E8A22B)', warn: '#E8A22B', critical: '#E5484D' };

function ago(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StaffBell({ role, staffId, triggerClassName }: { role: string; staffId: string; triggerClassName?: string }) {
  const { items, unread } = useStaffFeed({ role, staffId });
  const [open, setOpen] = useState(false);

  const toggle = () => {
    setOpen((o) => {
      if (!o) markSeen(); // opening clears the unread badge
      return !o;
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className={`relative ${triggerClassName ?? 'w-9 h-9 rounded-xl grid place-items-center'}`}
        style={triggerClassName ? undefined : { background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
      >
        <Bell size={18} aria-hidden />
        {unread > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-extrabold text-white tnum"
            style={{ background: 'var(--clay, #E5484D)' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[799]" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="fixed z-[800] w-[min(360px,calc(100vw-1.5rem))] rounded-2xl overflow-hidden shadow-xl"
            style={{
              top: 'calc(env(safe-area-inset-top) + 0.75rem)',
              right: 'max(0.75rem, env(safe-area-inset-right))',
              background: 'var(--paper, #fff)', border: '1px solid var(--line, #e5e0d6)', color: 'var(--ink, #15110d)',
            }}
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--line, #e5e0d6)' }}>
              <h4 className="font-bold text-sm">Notifications</h4>
              <button onClick={() => setOpen(false)} aria-label="Close" className="opacity-60 hover:opacity-100"><X size={16} aria-hidden /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--ink-3, #9a9387)' }}>No notifications yet.</p>
              ) : (
                items.map((n: FeedItem) => (
                  <div key={n.id} className="flex gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--line, #efe9df)' }}>
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: SEV_COLOR[n.severity] ?? SEV_COLOR.info }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold leading-snug">{n.title}</div>
                      {n.body && <div className="text-[12.5px] leading-snug mt-0.5" style={{ color: 'var(--ink-2, #5c564c)' }}>{n.body}</div>}
                      <div className="text-[11px] mt-1" style={{ color: 'var(--ink-3, #9a9387)' }}>{ago(n.at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
