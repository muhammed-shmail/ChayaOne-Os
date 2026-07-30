import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import { MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const tickets = await prisma.supportTicket.findMany({
    include: { tenant: true },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Support Tickets</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Manage platform support requests.</p>
      </header>
      
      <div className="lux-card card-glow overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--paper-3)] text-left text-xs uppercase tracking-wider text-[var(--ink-3)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Ticket</th>
              <th className="px-5 py-3 font-semibold">Cafe</th>
              <th className="px-5 py-3 font-semibold">Subject</th>
              <th className="px-5 py-3 font-semibold">Priority</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors cursor-pointer">
                <td className="px-5 py-4 font-mono text-xs">#{t.id.slice(0,6)}</td>
                <td className="px-5 py-4 font-bold">{t.tenant?.name ?? 'System'}</td>
                <td className="px-5 py-4 font-medium text-[var(--ink-2)] truncate max-w-xs">{t.subject}</td>
                <td className="px-5 py-4">
                  <span className={px-2 py-1 rounded text-[10px] font-bold uppercase }>
                    {t.priority}
                  </span>
                </td>
                <td className="px-5 py-4">
                   <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-[var(--paper-2)] border border-[var(--line)] text-[var(--ink-2)]">
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-[var(--ink-3)]">{t.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-[var(--ink-3)]">No support tickets found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
