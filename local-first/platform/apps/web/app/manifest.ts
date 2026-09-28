import type { MetadataRoute } from 'next';

/**
 * Web app manifest — default staff & waiter PWA ("Add to Home Screen").
 * Next serves this at /manifest.webmanifest and injects the <link> automatically.
 * Customer surface at /app links its own scoped manifest (/manifest-customer.json).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/pos',
    name: 'ChayaOne Waiter',
    short_name: 'Waiter',
    description: 'ChayaOne OS Waiter POS & Floor Ordering Terminal',
    start_url: '/pos',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#DEAD61',
    theme_color: '#DEAD61',
    icons: [
      {
        src: '/icons/waiter-192.png?v=6',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/waiter-512.png?v=6',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/app.png?v=6',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      { name: 'Waiter POS', short_name: 'POS', url: '/pos' },
      { name: 'Staff Login', short_name: 'Login', url: '/login' },
    ],
  };
}
