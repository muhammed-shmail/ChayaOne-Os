import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import { Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const invoices = await prisma.subInvoice.findMany({
    include: { subscription: { include: { tenant: true, plan: true } } },
    orderBy: { issuedAt: 'desc' },
    take: 50
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Invoices</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Manage platform subscription invoices.</p>
      </header>
      <div className="lux-card card-glow overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--paper-3)] text-left text-xs uppercase tracking-wider text-[var(--ink-3)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Invoice ID</th>
              <th className="px-5 py-3 font-semibold">Cafe</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Issued At</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">
                <td className="px-5 py-4 font-mono text-xs">{inv.id.split('-')[0].toUpperCase()}</td>
                <td className="px-5 py-4 font-bold">{inv.subscription.tenant.name}</td>
                <td className="px-5 py-4 font-medium">?{(inv.amountPaise / 100).toLocaleString()}</td>
                <td className="px-5 py-4">
                  <span className={px-2 py-1 rounded text-[10px] font-bold uppercase }>
                    {inv.status}
                  </span>
                </td>
                <td className="px-5 py-4">{inv.issuedAt.toLocaleDateString()}</td>
                <td className="px-5 py-4 text-right">
                  <button className="btn btn-sm btn-ghost text-[var(--ink-3)] hover:text-[var(--gold)]">
                    <Download size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-[var(--ink-3)]">No invoices found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
