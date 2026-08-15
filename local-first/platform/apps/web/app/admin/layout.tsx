import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { GlobalSearch } from './GlobalSearch';
import { AdminBar } from './AdminBar';
import { AdminSidebar } from './AdminSidebar';
import { Bell } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Control-plane chrome. When a platform admin is signed in we render a shared
 * sidebar and top bar (search + notifications + 2FA/sign-out) above every console page.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getPlatformSession();
  if (!s) return <>{children}</>;

  const admin = await prisma.platformAdmin.findUnique({ where: { id: s.adminId }, select: { totpEnabled: true } });

  return (
    <div className="min-h-screen flex text-[var(--ink)]" style={{ background: 'var(--paper)' }}>
      {/* New Sidebar Layout */}
      <AdminSidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Header */}
        <header 
          className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-4 border-b backdrop-blur pl-16 lg:pl-6"
          style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 86%, transparent)' }}
        >
          {/* Global Search */}
          <GlobalSearch />
          
          <div className="flex items-center gap-4 ml-auto">
            {/* Notifications */}
            <button className="relative p-2 rounded-full hover:bg-[var(--paper-3)] transition-colors text-[var(--ink-2)] hover:text-[var(--gold)]">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--danger)] border-2 border-[var(--paper)]"></span>
            </button>
            
            <div className="w-px h-6 bg-[var(--line)]"></div>
            
            <AdminBar name={s.name} totpEnabled={!!admin?.totpEnabled} />
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
