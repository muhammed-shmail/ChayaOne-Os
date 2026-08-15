import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const admins = await prisma.platformAdmin.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Platform Security</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Manage super admin access and global security policies.</p>
      </header>
      
      <div className="lux-card card-glow overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--paper-3)] text-left text-xs uppercase tracking-wider text-[var(--ink-3)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">2FA Status</th>
              <th className="px-5 py-3 font-semibold">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((adm) => (
              <tr key={adm.id} className="border-b border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">
                <td className="px-5 py-4 font-bold flex items-center gap-2">
                  <Shield size={14} className={adm.role === 'super_admin' ? 'text-[var(--gold)]' : 'text-[var(--ink-3)]'} />
                  {adm.name}
                </td>
                <td className="px-5 py-4 text-[var(--ink-2)]">{adm.email}</td>
                <td className="px-5 py-4 font-mono text-xs">{adm.role}</td>
                <td className="px-5 py-4">
                  {adm.totpEnabled ? (
                    <span className="text-[var(--ok)] font-bold text-xs uppercase tracking-wider">Enabled</span>
                  ) : (
                    <span className="text-[var(--danger)] font-bold text-xs uppercase tracking-wider">Disabled</span>
                  )}
                </td>
                <td className="px-5 py-4 text-xs text-[var(--ink-3)]">{adm.lastLoginAt?.toLocaleString() ?? 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
