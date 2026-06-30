import type { Metadata } from 'next';
import StaffRuntime from '@/components/StaffRuntime';

// Point the kitchen display at the STAFF manifest too (kitchen staff install the
// same staff app and land on /kds via role-based routing).
export const metadata: Metadata = {
  applicationName: 'Cafe OS Staff',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Cafe Staff' },
  manifest: '/staff.webmanifest',
};

export default function KdsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <StaffRuntime pwa />
    </>
  );
}
