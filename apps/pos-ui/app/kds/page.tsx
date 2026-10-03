import { redirect } from 'next/navigation';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canAccess, landingFor } from '@/lib/rbac';
import { tenantHasFeature } from '@/lib/features';
import { isModuleEnabled } from '@/lib/modules';
import { toTicket, type Ticket } from '@/lib/realtime';
import { readKitchens } from '@/lib/kitchens';
import { readKitchenWorkflow } from '@/lib/kitchenWorkflow';
import KdsClient from './KdsClient';
import ModuleDisabledNotice from '@/components/ModuleDisabledNotice';

export const dynamic = 'force-dynamic';

/** Server component: require session, load the outlet's active kitchen tickets. */
export default async function KdsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  // role-based access: waiters work the floor/approvals, not the kitchen screen
  if (!canAccess(session, 'kds')) redirect(landingFor(session));

  const kdsEnabled = await isModuleEnabled('kds', session.outletId);
  if (!kdsEnabled) {
    return (
      <ModuleDisabledNotice
        moduleName="Kitchen Display System (KDS)"
        moduleKey="kds"
        description="The Kitchen Display System (KDS) module is currently disabled for this venue. An administrator can enable it in Settings → Modules without reinstalling."
      />
    );
  }

  const [outlet, orders] = await Promise.all([
    prisma.outlet.findUnique({ where: { id: session.outletId }, select: { name: true, settings: true } }),
    prisma.order.findMany({
      where: { outletId: session.outletId, status: { in: ['open', 'in_kitchen', 'ready'] } },
      orderBy: { placedAt: 'asc' }, // oldest first
      include: { items: true, table: { select: { label: true } }, customer: { select: { name: true } } },
    }),
  ]);

  if (!outlet) redirect('/api/auth/logout');

  const initial: Ticket[] = orders.map(toTicket);
  const name = outlet.name.split('—')[0]?.trim() ?? 'Kitchen';
  const kitchens = readKitchens(outlet.settings);
  const workflow = readKitchenWorkflow(outlet.settings);
  const staffAppEnabled = await tenantHasFeature(session.tenantId, 'staff_app');

  return <KdsClient outletName={name} initial={initial} kitchens={kitchens} workflow={workflow} staff={{ id: session.staffId, role: session.role, roles: session.roles, permissions: session.permissions, effectivePermissions: session.effectivePermissions }} staffAppEnabled={staffAppEnabled} />;
}
