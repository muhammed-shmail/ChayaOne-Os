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

export const dynamic = 'force-dynamic';

/** Server component: require session, load the outlet's active kitchen tickets. */
export default async function KdsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  // role-based access: waiters work the floor/approvals, not the kitchen screen
  if (!canAccess(session.role, 'kds')) redirect(landingFor(session.role));

  const kdsEnabled = await isModuleEnabled('kds', session.outletId);
  if (!kdsEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center" style={{ background: 'var(--paper-1)', color: 'var(--ink-1)' }}>
        <div className="max-w-md p-8 rounded-2xl border shadow-xl" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
              <line x1="6" y1="17" x2="18" y2="17"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">KDS Module Disabled</h1>
          <p className="text-sm opacity-80 mb-6">
            The Kitchen Display System (KDS) module is currently disabled for this venue. An administrator can enable it in <b>Settings → Modules</b> without reinstalling.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/pos" className="btn btn-primary px-4 py-2 rounded-lg font-medium">Return to POS</a>
            <a href="/dashboard?tab=settings" className="btn btn-ghost px-4 py-2 rounded-lg border font-medium">Settings</a>
          </div>
        </div>
      </div>
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

  return <KdsClient outletName={name} initial={initial} kitchens={kitchens} workflow={workflow} staff={{ id: session.staffId, role: session.role }} staffAppEnabled={staffAppEnabled} />;
}
