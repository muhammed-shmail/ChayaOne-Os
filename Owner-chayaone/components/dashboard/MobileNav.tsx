'use client';

import { useEffect, useRef } from 'react';
import { LogOut, Menu, type LucideIcon } from '@/components/ui';

export type NavItem = { key: string; label: string; icon: LucideIcon };

const ACTIVE_STYLE = {
  background: 'var(--turmeric)',
  color: '#2A1607',
  fontWeight: 700,
  boxShadow: '0 6px 16px -6px color-mix(in srgb, var(--turmeric) 75%, transparent)',
} as const;

export function MobileDrawer({
  open,
  onClose,
  items,
  activeKey,
  onSelect,
  plan = 'Pro',
  onLogout,
  staffRole,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  plan?: string;
  onLogout: () => void;
  staffRole?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[1000] md:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'var(--scrim)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute left-0 top-0 h-full w-[82%] max-w-[300px] flex flex-col gap-1 p-4 overflow-y-auto no-scrollbar transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--paper-2)',
          borderRight: '1px solid var(--line)',
          paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
          paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center justify-center px-2 py-3 mb-2">
          <img
            src="/logo chaya one.png"
            alt="ChayaOne"
            style={{ width: '100%', height: 'auto', maxWidth: 150 }}
            className="brand-logo object-contain"
          />
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {items.map((m) => {
            const on = activeKey === m.key;
            const Ic = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => {
                  onSelect(m.key);
                  onClose();
                }}
                aria-current={on ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition ${
                  on ? '' : 'hover:bg-[var(--paper-3)]'
                }`}
                style={on ? ACTIVE_STYLE : { color: 'var(--ink-2)' }}
              >
                <Ic size={18} aria-hidden className="shrink-0" />
                {m.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-2.5 mt-auto text-sm text-left rounded-xl transition hover:bg-[var(--paper-3)]"
          style={{ color: 'var(--danger)' }}
        >
          <LogOut size={16} aria-hidden /> Sign Out
        </button>
      </aside>
    </div>
  );
}

export function BottomNav({
  items,
  activeKey,
  onSelect,
  onMore,
  drawerOpen,
  liveOrders = 0,
}: {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onMore: () => void;
  drawerOpen: boolean;
  liveOrders?: number;
}) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-[60] grid md:hidden"
      style={{
        gridTemplateColumns: `repeat(${items.length + 1}, 1fr)`,
        background: 'color-mix(in srgb, var(--paper-2) 92%, transparent)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--line)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Primary"
    >
      {items.map((m) => {
        const on = !drawerOpen && activeKey === m.key;
        const Ic = m.icon;
        return (
          <button
            key={m.key}
            onClick={() => onSelect(m.key)}
            aria-current={on ? 'page' : undefined}
            className="relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition"
            style={{ minHeight: 56, color: on ? 'var(--turmeric-d)' : 'var(--ink-3)' }}
          >
            <span className="relative">
              <Ic size={20} aria-hidden />
              {m.key === 'orders' && liveOrders > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full text-[9px] font-extrabold text-white"
                  style={{ background: 'var(--clay)' }}
                >
                  {liveOrders > 9 ? '9+' : liveOrders}
                </span>
              )}
            </span>
            <span className="leading-none">{m.label}</span>
            {on && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full"
                style={{ background: 'var(--turmeric)' }}
              />
            )}
          </button>
        );
      })}
      <button
        onClick={onMore}
        aria-current={drawerOpen ? 'page' : undefined}
        aria-haspopup="dialog"
        className="relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition"
        style={{ minHeight: 56, color: drawerOpen ? 'var(--turmeric-d)' : 'var(--ink-3)' }}
      >
        <Menu size={20} aria-hidden />
        <span className="leading-none">More</span>
        {drawerOpen && (
          <span
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full"
            style={{ background: 'var(--turmeric)' }}
          />
        )}
      </button>
    </nav>
  );
}
