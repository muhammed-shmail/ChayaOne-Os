import type { Metadata } from 'next';
import StaffRuntime from '@/components/StaffRuntime';
import OfflineBanner from '@/components/OfflineBanner';
import { getSession } from '@/lib/auth';
import { tenantHasFeature } from '@/lib/features';

// Point the kitchen display at the STAFF manifest too (kitchen staff install the
// same staff app and land on /kds via role-based routing).
export const metadata: Metadata = {
  applicationName: 'Cafe OS Staff',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Cafe Staff' },
  manifest: '/staff.webmanifest',
};

export default async function KdsLayout({ children }: { children: React.ReactNode }) {
  // Same per-cafe "Staff App (PWA)" gate as POS — off keeps KDS usable in the browser,
  // on turns kitchen staff's device into an installable app with push alerts.
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
