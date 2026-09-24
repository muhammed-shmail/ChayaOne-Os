import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Hanken_Grotesk, DM_Mono } from 'next/font/google';
import '@cafeos/ui/tokens.css';
import './globals.css';
import { PwaRegistration } from '@/components/PwaRegistration';

// Display: Cormorant Garamond — couture serif for headings (high-contrast,
// read at weight ≥500). Body: Hanken Grotesk. Numbers/receipts: DM Mono.
const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'], display: 'swap', variable: '--font-display' });
const body = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap', variable: '--font-body' });
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'ChayaOne',
  description: 'Order, earn points, and play — right from your table.',
  applicationName: 'ChayaOne',
  // installable PWA: iOS standalone + home-screen icons (icons are generated PNGs)
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ChayaOne' },
  other: {
    'mobile-web-app-capable': 'yes',
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
  viewportFit: 'cover', // respect notch / safe areas on mobile PWA
};

/* Set the persisted theme before first paint, auto-recover from ChunkLoadErrors, and suppress extension hydration warnings */
const initScript = `(function(){
  try {
    var t = localStorage.getItem('cafe-theme');
    if (!t) { t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    if (t === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); }
  } catch(e) {}
  try {
    var origErr = console.error;
    console.error = function() {
      var msg = arguments[0];
      if (typeof msg === 'string' && (msg.indexOf('fdprocessedid') !== -1 || (msg.indexOf('Extra attributes from the server') !== -1 && msg.indexOf('fdprocessedid') !== -1))) {
        return;
      }
      return origErr.apply(console, arguments);
    };
  } catch(e) {}
  window.addEventListener('error', function(e) {
    var m = (e && (e.message || (e.error && e.error.message))) || '';
    if (m.indexOf('ChunkLoadError') !== -1 || m.indexOf('Loading chunk') !== -1) {
      window.location.reload();
    }
  });
  window.addEventListener('unhandledrejection', function(e) {
    var m = (e && e.reason && (e.reason.message || e.reason.name)) || '';
    if (m.indexOf('ChunkLoadError') !== -1 || m.indexOf('Loading chunk') !== -1) {
      window.location.reload();
    }
  });
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
