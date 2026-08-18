import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WhiteLabelPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const branding = await prisma.tenantBranding.findMany({
    include: { tenant: true },
    orderBy: { tenantId: 'asc' }
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">White-Label Domains</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Manage custom domains and branding overrides for Enterprise tenants.</p>
      </header>
      
      <div className="lux-card card-glow overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--paper-3)] text-left text-xs uppercase tracking-wider text-[var(--ink-3)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Tenant</th>
              <th className="px-5 py-3 font-semibold">Custom Domain</th>
              <th className="px-5 py-3 font-semibold">App Name Override</th>
              <th className="px-5 py-3 font-semibold">"Powered By" Tag</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {branding.map((b) => (
              <tr key={b.tenantId} className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">
                <td className="px-5 py-4 font-bold">{b.tenant.name}</td>
                <td className="px-5 py-4 font-mono text-[var(--gold-d)]">{b.customDomain ?? '�'}</td>
                <td className="px-5 py-4">{b.appName ?? '�'}</td>
                <td className="px-5 py-4">
                  {b.poweredBy ? (
                    <span className="text-[var(--ok)] font-bold">Enabled</span>
                  ) : (
                    <span className="text-[var(--warn)] font-bold">Hidden (White-labeled)</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <button className="btn btn-sm btn-ghost text-[var(--ink-3)] hover:text-[var(--gold)]">Edit</button>
                </td>
              </tr>
            ))}
            {branding.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-[var(--ink-3)]">No custom branding records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
