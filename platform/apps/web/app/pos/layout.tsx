import type { Metadata } from 'next';
import StaffRuntime from '@/components/StaffRuntime';

// Point this surface at the STAFF manifest so phones install the staff app
// (own identity + start_url), not the customer app linked by the root layout.
export const metadata: Metadata = {
  applicationName: 'Cafe OS Staff',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Cafe Staff' },
  manifest: '/staff.webmanifest',
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <StaffRuntime pwa />
    </>
  );
}
