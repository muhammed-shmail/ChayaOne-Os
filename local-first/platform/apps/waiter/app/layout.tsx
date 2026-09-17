import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Hanken_Grotesk, DM_Mono } from 'next/font/google';
import '@cafeos/ui/tokens.css';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});
const body = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-body',
});
const mono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ChayaOne Waiter',
  description: 'ChayaOne OS Waiter & Floor Staff Terminal',
  manifest: '/waiter.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ChayaOne Waiter',
  },
  icons: { icon: '/app.png?v=4', shortcut: '/favicon.ico', apple: '/app.png?v=4' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6EFE3' },
    { media: '(prefers-color-scheme: dark)', color: '#15110D' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

const noFlashTheme = `(function(){try{var t=localStorage.getItem('cafe-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased selection:bg-[var(--gold)] selection:text-[var(--espresso)] pb-20" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
        {children}
      </body>
    </html>
  );
}
