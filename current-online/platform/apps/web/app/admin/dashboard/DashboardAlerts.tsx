'use client';

import { AlertTriangle, AlertCircle, CheckCircle, Info, RefreshCcw, XCircle, Store } from 'lucide-react';
import Link from 'next/link';

type AlertType = 'critical' | 'warning' | 'success' | 'info';

interface Alert {
  id: string;
  type: AlertType;
  title: string;
  count: number;
  href: string;
  icon: any;
}

export function DashboardAlerts() {
  // Hardcoded mock data as per requirements
  const alerts: Alert[] = [
    { id: '1', type: 'critical', title: 'subscriptions expire today', count: 6, href: '/admin/subscriptions', icon: AlertCircle },
    { id: '2', type: 'warning', title: 'subscriptions expire within 8 days', count: 12, href: '/admin/subscriptions', icon: AlertTriangle },
    { id: '3', type: 'warning', title: 'payment failures', count: 5, href: '/admin/subscriptions/payments', icon: XCircle },
    { id: '4', type: 'critical', title: 'suspended cafes', count: 2, href: '/admin/cafes/suspended', icon: Ban },
    { id: '5', type: 'success', title: 'new cafés joined this week', count: 15, href: '/admin/cafes', icon: Store },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {alerts.map((alert) => (
        <Link key={alert.id} href={alert.href} className="block transition-transform hover:-translate-y-1">
          <div className={`p-4 rounded-xl border flex items-center gap-4 ${
            alert.type === 'critical' ? 'bg-[var(--danger-bg)] border-[var(--danger)] text-[var(--danger-ink)]' :
            alert.type === 'warning' ? 'bg-[var(--warn-bg)] border-[var(--warn)] text-[var(--warn-ink)]' :
            alert.type === 'success' ? 'bg-[var(--ok-bg)] border-[var(--ok)] text-[var(--ok-ink)]' :
            'bg-[var(--info-bg)] border-[var(--info)] text-[var(--info-ink)]'
          }`}>
            <div className="flex-shrink-0">
              <alert.icon size={24} />
            </div>
            <div className="leading-tight">
              <span className="font-display font-bold text-xl block">{alert.count}</span>
              <span className="text-xs uppercase tracking-wide font-semibold opacity-90">{alert.title}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// Quick placeholder for Ban icon since it wasn't imported at top
function Ban(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="m4.9 4.9 14.2 14.2"/>
    </svg>
  );
}
