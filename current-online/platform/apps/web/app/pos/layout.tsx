import type { Metadata } from 'next';
import StaffRuntime from '@/components/StaffRuntime';
import OfflineBanner from '@/components/OfflineBanner';
import { getSession } from '@/lib/auth';
import { tenantHasFeature } from '@/lib/features';

// Point this surface at the STAFF manifest so phones install the staff app
// (own identity + start_url), not the customer app linked by the root layout.
export const metadata: Metadata = {
  applicationName: 'Cafe OS Staff',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Cafe Staff' },
  manifest: '/staff.webmanifest',
};

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  // The installable staff-app experience (SW, install banner, push) is gated on the
  // per-cafe "Staff App (PWA)" offer. When it's off, POS still works in the browser —
  // StaffRuntime's session keep-alive runs regardless; only `pwa` toggles the PWA layer.
  const session = await getSession();
  const staffAppEnabled = session ? await tenantHasFeature(session.tenantId, 'staff_app') : false;
  return (
    <>
      {children}
      <OfflineBanner />
      <StaffRuntime pwa={staffAppEnabled} />
    </>
  );
}
