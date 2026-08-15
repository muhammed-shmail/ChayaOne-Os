import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const paidInvoices = await prisma.subInvoice.findMany({
    where: { status: 'paid' },
    include: { subscription: { include: { tenant: true } } },
    orderBy: { paidAt: 'desc' },
    take: 50
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Payments</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">View successful platform payments.</p>
      </header>
      <div className="lux-card card-glow overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--paper-3)] text-left text-xs uppercase tracking-wider text-[var(--ink-3)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Payment ID</th>
              <th className="px-5 py-3 font-semibold">Cafe</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Gateway Ref</th>
              <th className="px-5 py-3 font-semibold">Paid At</th>
            </tr>
          </thead>
          <tbody>
            {paidInvoices.map((inv) => (
              <tr key={inv.id} className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">
                <td className="px-5 py-4 font-mono text-xs">{inv.id?.split('-')[0]?.toUpperCase()}</td>
                <td className="px-5 py-4 font-bold">{inv.subscription?.tenant ? inv.subscription.tenant.name : '—'}</td>
                <td className="px-5 py-4 font-medium text-[var(--ok)]">₹{(inv.amountPaise / 100).toLocaleString()}</td>
                <td className="px-5 py-4 font-mono text-xs text-[var(--ink-3)]">{inv.gatewayRef ?? 'Manual'}</td>
                <td className="px-5 py-4">{inv.paidAt?.toLocaleString() ?? '-'}</td>
              </tr>
            ))}
            {paidInvoices.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-[var(--ink-3)]">No successful payments found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
