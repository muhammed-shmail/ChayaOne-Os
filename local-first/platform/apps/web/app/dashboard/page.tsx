import { redirect } from 'next/navigation';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canAccess, landingFor, hasRole } from '@/lib/rbac';
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

/**
 * Dashboard page — server component.
 * Requires a session and renders the dashboard client for owner, manager, and cashier.
 */
export default async function DashboardPage({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canAccess(session, 'dashboard')) redirect(landingFor(session));

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
  const moduleConfig = await getModuleConfig(outlet.id);
  const receipt = readReceiptConfig(outlet.settings);
  const upiConfig = readUpiConfig(outlet.settings, outlet.name);

  const dashboardOutlet = { name: outlet.name, brand: outlet.tenant.name, plan: outlet.tenant.plan, gstin: outlet.gstin, receipt, upiConfig, settings: outlet.settings };

  const showOwner = hasRole(session, ['owner', 'accountant']) || (hasRole(session, 'manager') && searchParams?.view === 'owner');

  const staffContext = {
    id: session.staffId,
    name: session.name,
    role: session.role,
    roles: session.roles,
    permissions: session.permissions,
    effectivePermissions: session.effectivePermissions,
  };

  if (showOwner) {
    return (
      <DashboardClient
        outlet={dashboardOutlet}
        staff={staffContext}
        data={data}
        features={features}
        initialModuleConfig={moduleConfig}
      />
    );
  }

  return (
    <RoleDashboardClient
      outlet={dashboardOutlet}
      staff={staffContext}
      data={data}
      features={features}
    />
  );
}

