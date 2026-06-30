import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { AdminBar } from './AdminBar';
import { AdminNav } from './AdminNav';

export const dynamic = 'force-dynamic';

/**
 * Control-plane chrome. When a platform admin is signed in we render a shared
 * top bar (brand + nav + 2FA/sign-out) above every console page. The public
 * /admin/login page has no session, so it renders bare.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getPlatformSession();
  if (!s) return <>{children}</>;

  const admin = await prisma.platformAdmin.findUnique({ where: { id: s.adminId }, select: { totpEnabled: true } });

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div className="sticky top-0 z-40 flex items-center justify-between gap-4 px-6 py-3 border-b backdrop-blur"
        style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 86%, transparent)' }}>
        <div className="flex items-center gap-5">
          <div className="leading-none">
            <p className="font-display text-[11px] tracking-[0.3em] uppercase" style={{ color: 'var(--gold-d)' }}>Nuro7</p>
            <p className="font-display text-sm" style={{ color: 'var(--ink-2)' }}>Control Plane</p>
          </div>
          <AdminNav />
        </div>
        <AdminBar name={s.name} totpEnabled={!!admin?.totpEnabled} />
      </div>
      {children}
    </div>
  );
}
