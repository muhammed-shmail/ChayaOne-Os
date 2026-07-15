export const dynamic = 'force-static';

/**
 * Web app manifest for the STAFF PWA (installable POS) — separate from the
 * customer manifest at /manifest.webmanifest. Staff surfaces (/pos, /kds) link
 * this via `metadata.manifest` in their layouts, so a phone installs the staff
 * app — distinct identity (`id`), own start_url — rather than the guest app.
 *
 * `scope: '/'` so the same install also covers /kds (kitchen); role-based
 * routing sends each staff member to their landing screen after launch.
 */
export function GET() {
  const manifest = {
    id: '/pos',
    name: 'Cafe OS — Staff',
    short_name: 'Cafe Staff',
    description: 'Take orders, run the kitchen, and stay in sync — from your phone.',
    start_url: '/pos',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E0B08',
    theme_color: '#0E0B08',
    // app.png has a transparent background, so it is not declared `maskable`
    // (Android would clip it against no fill). Single `any` icon at real size.
    icons: [
      { src: '/app.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Floor / POS', short_name: 'POS', url: '/pos' },
      { name: 'Kitchen', short_name: 'KDS', url: '/kds' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  });
}
