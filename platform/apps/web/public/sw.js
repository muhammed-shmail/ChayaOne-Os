/* Cafe OS — service worker for the installable PWAs (customer + staff).
   Conservative by design:
     - shells (/app customer, /pos + /kds staff) are network-first, so they stay
       fresh online and fall back to the last cached page when the network drops;
     - static assets are cache-first;
     - everything else (dashboard / admin / API) goes straight to the network and
       is never cached.
   Read-only offline only (Phase 4 layers API GET caching on top of this). */
const CACHE = 'cafeos-pwa-v2';
// Public pages safe to precache at install (protected shells are cached at runtime
// once an authenticated staff member loads them — precaching them would just cache
// a /login redirect).
const PRECACHE = ['/app', '/manifest.webmanifest', '/staff.webmanifest'];
const SHELL_PREFIXES = ['/app', '/pos', '/kds'];

function shellRoot(pathname) {
  for (const p of SHELL_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + '/')) return p;
  }
  return null;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const root = shellRoot(url.pathname);
  const isStatic = url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons/') ||
    /\.(?:png|jpg|jpeg|svg|webp|gif|ico|woff2?)$/.test(url.pathname);

  // Everything else (dashboard / admin / api) → straight to network, untouched.
  if (!root && !isStatic) return;

  if (root) {
    // network-first so the shell stays fresh; fall back to the cached page (then
    // the shell root) when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match(root))),
    );
  } else {
    // cache-first for immutable static assets
    event.respondWith(
      caches.match(req).then((m) =>
        m ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }),
      ),
    );
  }
});
