import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ChayaOne — Table Menu & Order',
  applicationName: 'ChayaOne',
  description: 'Order, earn points, and play — right from your table.',
  manifest: '/manifest-customer.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ChayaOne' },
  icons: { icon: '/icons/customer-192.png', shortcut: '/icons/customer-192.png', apple: '/icons/customer-192.png' },
};

export default function CustomerEntryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
