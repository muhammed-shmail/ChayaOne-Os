export const dynamic = 'force-static';

/**
 * Web app manifest for the STAFF PWA (installable POS).
 * Staff surfaces (/pos, /kds, /waiter, /login) link this via metadata.manifest.
 */
export function GET() {
  const manifest = {
    id: '/pos',
    name: 'ChayaOne Waiter',
    short_name: 'Waiter',
    description: 'ChayaOne OS Waiter POS & Floor Ordering Terminal',
    start_url: '/pos',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#14110F',
    theme_color: '#E8902A',
    icons: [
      {
        src: '/icons/waiter-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/waiter-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/app.png?v=4',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      { name: 'Waiter POS', short_name: 'POS', url: '/pos' },
      { name: 'Kitchen', short_name: 'KDS', url: '/kds' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  });
}
