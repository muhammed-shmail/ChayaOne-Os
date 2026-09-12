import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getDashboardData } from '@/lib/analytics';
import { tenantBilling } from '@/lib/billing';
import { tenantFeatures } from '@/lib/features';
import { getModuleConfig } from '@/lib/modules';
import { readReceiptConfig } from '@/lib/receipt';
import { readUpiConfig } from '@/lib/print/upi';
import { BillingWall } from '@/components/BillingWall';
import DashboardClient from './DashboardClient';
import RoleDashboardClient from './RoleDashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['owner', 'manager', 'cashier', 'accountant'].includes(session.role)) redirect('/login');

  const requestedOutletId = searchParams?.outletId || session.outletId;

  let outlet = await prisma.outlet.findUnique({
    where: { id: requestedOutletId },
    select: { id: true, name: true, gstin: true, settings: true, tenant: { select: { name: true, plan: true } } },
  });

  if (!outlet) {
    outlet = await prisma.outlet.findFirst({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, gstin: true, settings: true, tenant: { select: { name: true, plan: true } } },
    });
  }

  if (!outlet) redirect('/login');

  const billing = await tenantBilling(session.tenantId).catch(() => ({ blocked: false, reason: '' }));
  if (billing.blocked) return <BillingWall brand={outlet.tenant.name} reason={billing.reason} />;

  const data = await getDashboardData(outlet.id);
  const features = await tenantFeatures(session.tenantId).catch(() => ({ crm: true, inventory: true, reports: true }));
  const moduleConfig = await getModuleConfig(outlet.id);
  const receipt = readReceiptConfig(outlet.settings);
  const upiConfig = readUpiConfig(outlet.settings, outlet.name);

  const dashboardOutlet = { name: outlet.name, brand: outlet.tenant.name, plan: outlet.tenant.plan, gstin: outlet.gstin, receipt, upiConfig };

  const showOwner = session.role === 'owner' || session.role === 'accountant' || (session.role === 'manager' && searchParams?.view === 'owner');

  if (showOwner) {
    return (
      <DashboardClient
        outlet={dashboardOutlet}
        staff={{ name: session.name, role: session.role }}
        data={data}
        features={features}
        initialModuleConfig={moduleConfig}
      />
    );
  }

  return (
    <RoleDashboardClient
      outlet={dashboardOutlet}
      staff={{ id: session.staffId, name: session.name, role: session.role }}
      data={data}
      features={features}
    />
  );
}
