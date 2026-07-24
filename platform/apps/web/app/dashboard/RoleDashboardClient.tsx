'use client';

import Link from 'next/link';
import type React from 'react';
import { formatINR } from '@cafeos/core';
import type { DashboardData } from '@/lib/analytics';
import type { ReceiptConfig } from '@/lib/receipt';
import {
  BarChart3, ChefHat, ClipboardList, LayoutDashboard, LogOut, Package,
  QrCode, ShoppingCart, Table2, Users as UsersIcon, Wifi,
} from '@/components/ui';
import { ShiftStatus } from '@/components/ShiftStatus';
import StaffBell from '@/components/StaffBell';

type RoleDashboardProps = {
  outlet: { name: string; brand: string; plan: string; gstin: string | null; receipt: ReceiptConfig };
  staff: { id: string | null; name: string; role: string };
  data: DashboardData;
  features: Record<string, boolean>;
};

export default function RoleDashboardClient({ outlet, staff, data, features }: RoleDashboardProps) {
  const isManager = staff.role === 'manager';
  const crmEnabled = features.crm !== false;
  const kpi = data.kpi;
  const actions = isManager
    ? [
        { href: '/pos', label: 'Open POS', icon: ShoppingCart, tone: 'primary' },
        { href: '/kds', label: 'Kitchen Display', icon: ChefHat },
        { href: '/approvals', label: 'QR Approvals', icon: QrCode },
        { href: '/dashboard?view=owner', label: 'Owner Dashboard', icon: LayoutDashboard },
      ]
    : [
        { href: '/pos', label: 'Open POS', icon: ShoppingCart, tone: 'primary' },
        { href: '/kds', label: 'Kitchen Display', icon: ChefHat },
        { href: '/approvals', label: 'QR Approvals', icon: QrCode },
      ];

  return (
    <main className="min-h-screen p-4 md:p-6" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <header className="flex flex-wrap items-center gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-display font-extrabold">
            {isManager ? 'Manager Dashboard' : 'Cashier Dashboard'}
          </h1>
          <p className="text-sm font-bold truncate" style={{ color: 'var(--ink-3)' }}>{outlet.name} · {staff.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {staff.id && <StaffBell role={staff.role} staffId={staff.id} triggerClassName="btn btn-icon btn-sm btn-ghost" />}
          <a href="/api/auth/logout" className="btn btn-sm"><LogOut size={16} aria-hidden /> Logout</a>
        </div>
      </header>

      {isManager ? (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Metric label="Today Sales" value={formatINR(kpi.todaySalesPaise)} />
            <Metric label="Orders" value={String(kpi.todayOrders)} />
            <Metric label="AOV" value={formatINR(kpi.aovPaise)} />
            <Metric label="Footfall" value={String(kpi.footfall)} />
          </section>

          <section className="grid lg:grid-cols-[1.1fr_.9fr] gap-4">
            <div className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-display font-bold text-lg">Quick Actions</h2>
                <span className="pill capitalize">{staff.role}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {actions.map(({ href, label, icon: Icon, tone }) => (
                  <Link key={label} href={href} className={tone === 'primary' ? 'btn btn-primary justify-start' : 'btn justify-start'}>
                    <Icon size={18} aria-hidden /> {label}
                  </Link>
                ))}
              </div>
              <div className="mt-4">
                <ShiftStatus />
              </div>
            </div>

            <div className="card p-4">
              <h2 className="font-display font-bold text-lg mb-3">Live Focus</h2>
              <div className="flex flex-col gap-2">
                <Focus icon={Wifi} label="Service rhythm" value={kpi.todayOrders > 0 ? 'Orders are flowing' : 'No orders yet'} />
                <Focus icon={Table2} label="Tables and queue" value={`${data.loyalty.qrScanPct}% dine-in QR share`} />
                <Focus icon={Package} label="Stock alerts" value={`${data.lowStock.length} item${data.lowStock.length === 1 ? '' : 's'} need attention`} />
                {crmEnabled && <Focus icon={UsersIcon} label="CRM" value={`${data.loyalty.customers} customers tracked`} />}
              </div>
            </div>

            <div className="card p-4">
              <h2 className="font-display font-bold text-lg mb-3">Top Items</h2>
              <div className="flex flex-col gap-2">
                {data.topItems.slice(0, 5).map((i) => (
                  <div key={i.name} className="flex items-center justify-between gap-3 rounded-[12px] px-3 py-2" style={{ background: 'var(--paper-3)' }}>
                    <span className="font-bold text-sm min-w-0 truncate">{i.name}</span>
                    <span className="tnum text-sm" style={{ color: 'var(--ink-3)' }}>{i.qty} · {formatINR(i.revenuePaise)}</span>
                  </div>
                ))}
                {data.topItems.length === 0 && <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No sales yet today.</p>}
              </div>
            </div>

            <div className="card p-4">
              <h2 className="font-display font-bold text-lg mb-3">Manager Notes</h2>
              <div className="flex flex-col gap-2">
                {data.briefing.slice(0, 4).map((b, i) => (
                  <div key={i} className="rounded-[12px] border px-3 py-2" style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}>
                    <p className="text-sm font-bold">{b.text}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--cardamom-d)' }}>{b.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Cashier Dashboard — Single Panel Layout */
        <div className="card p-5 max-w-4xl mx-auto flex flex-col gap-6">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-display font-bold text-lg">Quick Actions</h2>
              <span className="pill capitalize">{staff.role}</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {actions.map(({ href, label, icon: Icon, tone }) => (
                <Link key={label} href={href} className={tone === 'primary' ? 'btn btn-primary justify-start' : 'btn justify-start'}>
                  <Icon size={18} aria-hidden /> {label}
                </Link>
              ))}
            </div>
            <div className="mt-4">
              <ShiftStatus />
            </div>
          </div>

          <hr className="border-line" style={{ borderColor: 'var(--line)' }} />

          <div>
            <h2 className="font-display font-bold text-lg mb-4">Live Focus</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <Focus icon={Wifi} label="Service rhythm" value={kpi.todayOrders > 0 ? 'Orders are flowing' : 'No orders yet'} />
              <Focus icon={Table2} label="Tables and queue" value={`${data.loyalty.qrScanPct}% dine-in QR share`} />
              <Focus icon={Package} label="Stock alerts" value={`${data.lowStock.length} item${data.lowStock.length === 1 ? '' : 's'} need attention`} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="card p-4">
      <p className="text-xs font-bold mb-2" style={{ color: 'var(--ink-3)' }}>{label}</p>
      <p className="text-2xl font-display font-extrabold tnum">{value}</p>
    </section>
  );
}

function Focus({ icon: Icon, label, value }: { icon: React.ComponentType<any>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] px-3 py-2" style={{ background: 'var(--paper-3)' }}>
      <span className="grid place-items-center w-9 h-9 rounded-[10px]" style={{ background: 'var(--paper-2)', color: 'var(--turmeric-d)' }}>
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold" style={{ color: 'var(--ink-3)' }}>{label}</span>
        <span className="block text-sm font-bold truncate">{value}</span>
      </span>
    </div>
  );
}
