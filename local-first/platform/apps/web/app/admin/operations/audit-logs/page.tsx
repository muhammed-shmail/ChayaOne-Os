import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const logs = await prisma.platformAudit.findMany({
    include: { admin: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Platform Audit Logs</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Review super admin actions and platform events.</p>
      </header>
      
      <div className="lux-card card-glow overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--paper-3)] text-left text-xs uppercase tracking-wider text-[var(--ink-3)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Time</th>
              <th className="px-5 py-3 font-semibold">Admin</th>
              <th className="px-5 py-3 font-semibold">Action</th>
              <th className="px-5 py-3 font-semibold">Target Tenant</th>
              <th className="px-5 py-3 font-semibold">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">
                <td className="px-5 py-3 text-xs text-[var(--ink-3)]">{log.createdAt.toLocaleString()}</td>
                <td className="px-5 py-3 font-medium">{log.admin?.name ?? 'System'}</td>
                <td className="px-5 py-3 font-mono text-xs text-[var(--gold-d)]">{log.action}</td>
                <td className="px-5 py-3 text-xs">{log.targetTenantId ?? '—'}</td>
                <td className="px-5 py-3 text-xs font-mono text-[var(--ink-3)]">{log.ip ?? '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-[var(--ink-3)]">No audit logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
