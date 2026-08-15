import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RenewalsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  // Find subs expiring in the next 30 days
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  const renewals = await prisma.subscription.findMany({
    where: { 
      status: { in: ['active', 'past_due', 'trialing'] },
      currentEnd: { lte: thirtyDaysFromNow }
    },
    include: { tenant: true, plan: true },
    orderBy: { currentEnd: 'asc' }
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Upcoming Renewals</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Monitor and alert cafes with expiring subscriptions.</p>
      </header>
      <div className="lux-card card-glow overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--paper-3)] text-left text-xs uppercase tracking-wider text-[var(--ink-3)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Cafe</th>
              <th className="px-5 py-3 font-semibold">Plan</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Expiry Date</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {renewals.map((sub) => {
              const diffDays = Math.ceil(((sub.currentEnd?.getTime() ?? 0) - Date.now()) / (1000 * 60 * 60 * 24));
              const isExpired = diffDays < 0;
              return (
                <tr key={sub.id} className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">
                  <td className="px-5 py-4 font-bold">{sub.tenant.name}</td>
                  <td className="px-5 py-4 text-[var(--ink-2)] capitalize">{sub.plan.name}</td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-[var(--warn-bg)] text-[var(--warn-ink)]">{sub.status}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className={isExpired ? 'text-[var(--danger)] font-bold' : diffDays <= 7 ? 'text-[var(--warn)] font-bold' : ''}>
                      {sub.currentEnd?.toLocaleDateString()}
                    </div>
                    <div className="text-xs text-[var(--ink-3)] mt-0.5">{isExpired ? `Expired ${Math.abs(diffDays)} days ago` : `In ${diffDays} days`}</div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button className="btn btn-sm btn-ghost text-[var(--gold-d)] border-[var(--gold)]/30 hover:border-[var(--gold)]">Send Alert</button>
                  </td>
                </tr>
              );
            })}
            {renewals.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-[var(--ink-3)]">No upcoming renewals in the next 30 days.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
