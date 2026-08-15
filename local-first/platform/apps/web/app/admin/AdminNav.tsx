'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Shared control-plane navigation (Console / Tenants / Operations). */
const TABS = [
  { href: '/admin', label: 'Console', exact: true },
  { href: '/admin/tenants', label: 'Tenants', exact: false },
  { href: '/admin/ops', label: 'Operations', exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-lg px-3 py-1.5 text-sm font-bold transition-colors"
            style={{
              color: active ? 'var(--ink)' : 'var(--ink-3)',
              background: active ? 'var(--paper-3)' : 'transparent',
              border: active ? '1px solid var(--line)' : '1px solid transparent',
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
