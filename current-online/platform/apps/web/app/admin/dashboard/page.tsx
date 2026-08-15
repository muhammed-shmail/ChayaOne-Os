import { redirect } from 'next/navigation';
import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { DashboardKPIs } from './DashboardKPIs';
import { DashboardAlerts } from './DashboardAlerts';
import { DashboardCharts } from './DashboardCharts';
import { RecentActivityTimeline } from './RecentActivityTimeline';
import { PlatformHealth } from './PlatformHealth';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [tenantCount, statusGroups, ordersToday, activeSubs] = await Promise.all([
    prisma.tenant.count(),
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.count({ where: { placedAt: { gte: startOfDay } } }),
    prisma.subscription.findMany({
      where: { status: { in: ['active', 'past_due'] } },
      select: {
        customPriceMonthlyPaise: true,
        plan: { select: { pricePaise: true } },
      },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) byStatus[g.status] = g._count._all;

  let mrrPaise = 0;
  for (const sub of activeSubs) {
    if (sub.customPriceMonthlyPaise !== null && sub.customPriceMonthlyPaise !== undefined) {
      mrrPaise += sub.customPriceMonthlyPaise;
    } else {
      const pp = (sub.plan.pricePaise ?? {}) as { monthly?: number };
      mrrPaise += Number(pp.monthly ?? 0);
    }
  }

  const data = {
    totalCafes: tenantCount,
    activeCafes: byStatus.active ?? 0,
    trialCafes: byStatus.trialing ?? 0,
    suspendedCafes: (byStatus.suspended ?? 0) + (byStatus.expired ?? 0),
    ordersToday: ordersToday,
    revenueToday: ordersToday * 35000, // Mock calculation for demo purposes
    mrr: mrrPaise,
    arr: mrrPaise * 12,
    branches: Math.floor(tenantCount * 1.5), // Mock
    staff: Math.floor(tenantCount * 5), // Mock
    customers: Math.floor(tenantCount * 120), // Mock
    tickets: 5, // Mock
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Platform Overview</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Monitor cross-tenant health, revenue, and platform operations.</p>
      </header>

      {/* Subscription Alerts */}
      <section>
        <DashboardAlerts />
      </section>

      {/* Main KPIs */}
      <section>
        <DashboardKPIs data={data} />
      </section>

      {/* Charts & Growth */}
      <section>
        <DashboardCharts />
      </section>

      {/* Timeline & Health */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
        <RecentActivityTimeline />
        <PlatformHealth />
      </section>
    </div>
  );
}
