import { redirect } from 'next/navigation';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { isModuleEnabled } from '@/lib/modules';
import ApprovalsClient, { type PendingOrder } from './ApprovalsClient';

export const dynamic = 'force-dynamic';

/**
 * Waiter approval dashboard. Any signed-in staff member can view; kitchen staff
 * see it read-only (they can't approve). QR orders land here as pending and only
 * reach the KDS once a waiter confirms.
 */
export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const waiterEnabled = await isModuleEnabled('waiter', session.outletId);
  if (!waiterEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center" style={{ background: 'var(--paper-1)', color: 'var(--ink-1)' }}>
        <div className="max-w-md p-8 rounded-2xl border shadow-xl" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Waiter Module Disabled</h1>
          <p className="text-sm opacity-80 mb-6">
            The Waiter & Floor Approvals module is currently disabled for this venue. An administrator can enable it in <b>Settings → Modules</b> without reinstalling.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/pos" className="btn btn-primary px-4 py-2 rounded-lg font-medium">Return to POS</a>
            <a href="/dashboard?tab=settings" className="btn btn-ghost px-4 py-2 rounded-lg border font-medium">Settings</a>
          </div>
        </div>
      </div>
    );
  }

  const outlet = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { name: true } });
  if (!outlet) redirect('/api/auth/logout');

  const orders = await prisma.order.findMany({
    where: { outletId: session.outletId, status: 'pending_approval' },
    orderBy: { placedAt: 'asc' },
    include: { items: { orderBy: { id: 'asc' } }, table: { select: { label: true } } },
  });

  const initial: PendingOrder[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    table: o.table?.label ?? '—',
    channel: o.channel,
    placedAt: o.placedAt.getTime(),
    totalPaise: o.totalPaise,
    items: o.items.map((i) => ({ id: i.id, name: i.nameSnapshot, qty: i.qty, station: i.station, notes: i.notes, unitPricePaise: i.unitPricePaise })),
  }));

  const name = outlet.name.split('—')[0]?.trim() ?? 'Outlet';
  return <ApprovalsClient outletName={name} role={session.role} initial={initial} />;
}
