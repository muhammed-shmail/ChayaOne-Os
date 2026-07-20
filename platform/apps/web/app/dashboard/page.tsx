import { redirect } from 'next/navigation';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { getDashboardData } from '@/lib/analytics';
import { tenantBilling } from '@/lib/billing';
import { tenantFeatures } from '@/lib/features';
import { readReceiptConfig } from '@/lib/receipt';
import { BillingWall } from '@/components/BillingWall';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

/**
 * Dashboard page — server component.
 * Requires a session and renders the dashboard client for owner, manager, and cashier.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['owner', 'manager', 'cashier'].includes(session.role)) redirect('/pos');

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { id: true, name: true, gstin: true, settings: true, tenant: { select: { name: true, plan: true } } },
  });
  if (!outlet) redirect('/api/auth/logout');

  // billing wall: suspended / expired tenants get a read-only screen (data preserved)
  const billing = await tenantBilling(session.tenantId);
  if (billing.blocked) return <BillingWall brand={outlet.tenant.name} reason={billing.reason} />;

  const data = await getDashboardData(outlet.id);
  const features = await tenantFeatures(session.tenantId);
  const receipt = readReceiptConfig(outlet.settings);

  const dashboardOutlet = { name: outlet.name, brand: outlet.tenant.name, plan: outlet.tenant.plan, gstin: outlet.gstin, receipt };

  return (
    <DashboardClient
      outlet={dashboardOutlet}
      staff={{ name: session.name, role: session.role }}
      data={data}
      features={features}
    />
  );
}
