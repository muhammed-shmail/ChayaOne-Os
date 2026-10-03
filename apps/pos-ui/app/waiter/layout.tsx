import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ChayaOne Waiter',
  applicationName: 'ChayaOne Waiter',
  description: 'ChayaOne OS Waiter POS & Floor Ordering Terminal',
  manifest: '/manifest-waiter.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ChayaOne Waiter',
  },
  icons: { icon: '/icons/waiter-192.png', shortcut: '/icons/waiter-192.png', apple: '/icons/waiter-192.png' },
};

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
