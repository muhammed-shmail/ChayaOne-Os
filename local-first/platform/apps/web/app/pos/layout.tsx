import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StaffRuntime from '@/components/StaffRuntime';
import OfflineBanner from '@/components/OfflineBanner';
import LicenseExpiryBanner from '@/components/license/LicenseExpiryBanner';
import { getSession } from '@/lib/auth';
import { tenantHasFeature } from '@/lib/features';
import { LicenseService } from '@/lib/license/license-service';

// Point this surface at the WAITER manifest so phones and tablets install the waiter app
// (own identity + start_url), not the customer app.
export const metadata: Metadata = {
  title: 'ChayaOne Waiter — POS & Table Orders',
  applicationName: 'ChayaOne Waiter',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ChayaOne Waiter' },
  manifest: '/manifest-waiter.json',
  icons: { icon: '/icons/waiter-192.png', shortcut: '/icons/waiter-192.png', apple: '/icons/waiter-192.png' },
};

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  // Gate POS operational access on active commercial license
  const licenseCheck = await LicenseService.isLicenseActive();
  if (!licenseCheck.active) {
    redirect('/expired');
  }

  const session = await getSession();
  const staffAppEnabled = session ? await tenantHasFeature(session.tenantId, 'staff_app') : false;
  return (
    <>
      <LicenseExpiryBanner />
      {children}
      <OfflineBanner />
      <StaffRuntime pwa={staffAppEnabled} />
    </>
  );
}
