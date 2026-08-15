import type { MetadataRoute } from 'next';

/**
 * Web app manifest — makes the customer PWA installable ("Add to Home Screen").
 * Next serves this at /manifest.webmanifest and injects the <link> automatically.
 * Uses a static PNG icon (public/app.png) — works in dev (Turbopack) and prod,
 * unlike @vercel/og which breaks under Turbopack on Windows.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ChayaOne — your cafe',
    short_name: 'ChayaOne',
    description: 'Order, earn points, and play — right from your table.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F6EFE3',
    theme_color: '#15110D',
    // app.png is a transparent-background chai glass, so it is NOT declared
    // `maskable`: Android would fill no background and clip the steam/base inside
    // the adaptive mask. Single `any` icon at real size; `?v=3` busts the
    // home-screen icon cache on redeploy.
    icons: [
      { src: '/app.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Order now', short_name: 'Order', url: '/app' },
      { name: 'My rewards', short_name: 'Rewards', url: '/app?tab=rewards' },
    ],
  };
}
