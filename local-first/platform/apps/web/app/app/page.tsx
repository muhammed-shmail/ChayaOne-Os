import { resolveTable } from '@/lib/customer';
import { isModuleEnabled } from '@/lib/modules';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PwaClient from './PwaClient';

export const dynamic = 'force-dynamic';

/**
 * /app — the Customer PWA. Public (no staff session). The QR token arrives as
 * ?t=<token>; the client loads everything from /api/customer/context (which
 * also binds the device's customer cookie).
 *
 * If opened without a table token (?t=) by an authenticated staff member (waiter/cashier),
 * immediately redirect to /pos so waiter tablets never get stuck in the customer view.
 */
export default async function CustomerApp({ searchParams }: { searchParams: { t?: string } }) {
  const token = searchParams.t ?? null;

  if (!token) {
    const session = await getSession();
    if (session) {
      redirect('/pos');
    }
  }

  if (token) {
    const table = await resolveTable(token);
    if (table) {
      const enabled = await isModuleEnabled('customer_qr', table.outlet.id);
      if (!enabled) {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center" style={{ background: '#f8fafc', color: '#0f172a' }}>
            <div className="max-w-sm rounded-3xl p-8 border shadow-lg bg-white">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2"/>
                  <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2">QR Ordering Unavailable</h1>
              <p className="text-sm text-slate-500 mb-6">
                Mobile QR ordering is currently disabled for this dining area. Please call a staff member or place your order at the counter.
              </p>
            </div>
          </div>
        );
      }
    }
  }

  return <PwaClient qrToken={token} />;
}

