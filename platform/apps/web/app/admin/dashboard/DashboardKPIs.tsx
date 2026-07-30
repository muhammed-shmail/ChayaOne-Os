'use client';

import { 
  Store, 
  Activity, 
  Clock, 
  Ban, 
  ShoppingCart, 
  IndianRupee, 
  TrendingUp, 
  Building2, 
  Users, 
  Heart, 
  Server, 
  Ticket 
} from 'lucide-react';
import Link from 'next/link';
import { Stagger, StaggerItem, CountUp } from '@/components/ui/motion';

type KPIData = {
  label: string;
  value: number;
  trend: number;
  icon: any;
  kind: 'num' | 'money' | 'percent';
  href: string;
};

const formatMoney = (paise: number) => '₹' + Math.round(paise / 100).toLocaleString('en-IN');
const formatNum = (x: number) => x.toLocaleString('en-IN');
const formatPercent = (x: number) => x + '%';

export function DashboardKPIs({ data }: { data: Record<string, number> }) {
  const kpis: KPIData[] = [
    { label: 'Total Cafes', value: data.totalCafes || 0, trend: 12, icon: Store, kind: 'num', href: '/admin/cafes' },
    { label: 'Active Cafes', value: data.activeCafes || 0, trend: 8, icon: Activity, kind: 'num', href: '/admin/cafes?status=active' },
    { label: 'Trial Cafes', value: data.trialCafes || 0, trend: -5, icon: Clock, kind: 'num', href: '/admin/cafes/trial' },
    { label: 'Suspended Cafes', value: data.suspendedCafes || 0, trend: 2, icon: Ban, kind: 'num', href: '/admin/cafes/suspended' },
    { label: "Today's Orders", value: data.ordersToday || 0, trend: 24, icon: ShoppingCart, kind: 'num', href: '/admin/analytics/orders' },
    { label: "Today's Revenue", value: data.revenueToday || 0, trend: 18, icon: IndianRupee, kind: 'money', href: '/admin/analytics/revenue' },
    { label: 'Monthly MRR', value: data.mrr || 0, trend: 15, icon: TrendingUp, kind: 'money', href: '/admin/analytics/revenue' },
    { label: 'Annual ARR', value: data.arr || 0, trend: 15, icon: TrendingUp, kind: 'money', href: '/admin/analytics/revenue' },
    { label: 'Branches', value: data.branches || 0, trend: 4, icon: Building2, kind: 'num', href: '/admin/cafes' },
    { label: 'Staff Members', value: data.staff || 0, trend: 10, icon: Users, kind: 'num', href: '/admin/cafes' },
    { label: 'Customers', value: data.customers || 0, trend: 32, icon: Heart, kind: 'num', href: '/admin/analytics/customers' },
    { label: 'Platform Uptime', value: 99.99, trend: 0, icon: Server, kind: 'percent', href: '/admin/platform/health' },
    { label: 'Open Tickets', value: data.tickets || 0, trend: -12, icon: Ticket, kind: 'num', href: '/admin/operations/tickets' },
  ];

  return (
    <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <StaggerItem key={kpi.label} className="block">
          <Link href={kpi.href} className="block lux-card card-glow p-5 h-full transition-colors group hover:bg-[var(--paper-3)]">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 rounded-xl bg-[var(--paper-3)] group-hover:bg-[var(--gold)]/10 text-[var(--ink-2)] group-hover:text-[var(--gold)] transition-colors">
                <kpi.icon size={20} />
              </div>
              
              <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                kpi.trend > 0 ? 'bg-[var(--ok-bg)] text-[var(--ok-ink)]' : 
                kpi.trend < 0 ? 'bg-[var(--danger-bg)] text-[var(--danger-ink)]' : 
                'bg-[var(--paper-3)] text-[var(--ink-3)]'
              }`}>
                {kpi.trend > 0 ? '↑' : kpi.trend < 0 ? '↓' : '−'} {Math.abs(kpi.trend)}%
              </div>
            </div>
            
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)] group-hover:text-[var(--ink-2)] transition-colors">
              {kpi.label}
            </p>
            <div className="font-display text-[28px] leading-tight mt-1 text-[var(--ink)]">
              {kpi.kind === 'money' ? formatMoney(kpi.value) : kpi.kind === 'percent' ? formatPercent(kpi.value) : formatNum(kpi.value)}
            </div>
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
