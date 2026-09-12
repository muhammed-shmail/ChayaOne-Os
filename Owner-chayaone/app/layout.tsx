import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { TenantProvider } from '@/lib/tenant/context';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-body' });
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-display' });

export const metadata: Metadata = {
  title: {
    default: 'ChayaOne Owner Dashboard',
    template: '%s · ChayaOne Owner',
  },
  description: 'Remote business management for ChayaOne — view sales, orders, menu, inventory, staff, and finance across all your stores.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ChayaOne Owner',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#E8902A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <link rel="icon" href="/fabicon.png" />
        <link rel="apple-touch-icon" href="/fabicon.png" />
      </head>
      <body style={{ background: 'var(--paper)', color: 'var(--ink)' }} className="antialiased min-h-screen">
        <TenantProvider>
          {children}
        </TenantProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
