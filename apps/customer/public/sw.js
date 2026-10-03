/* Cafe OS — service worker for the installable PWAs (customer + staff).
   Conservative by design:
     - shells (/app customer, /pos + /kds staff) are network-first, so they stay
       fresh online and fall back to the last cached page when the network drops;
     - static assets are cache-first;
     - everything else (dashboard / admin / API) goes straight to the network and
       is never cached.
   Read-only offline only (Phase 4 layers API GET caching on top of this). */
const CACHE = 'cafeos-pwa-v3';
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

// Read-only GET endpoints safe to serve stale while offline (P4). Low-sensitivity
// view data only — the floor occupancy and the staff notification history. Order
// placement / payments are POST and never cached. (No /api/stream — SSE can't be
// cached; the app falls back to the last-rendered shell when offline.)
const DATA_CACHE_API = ['/api/tables', '/api/approvals', '/api/staff/notifications'];
function isCacheableApi(pathname) {
  return DATA_CACHE_API.some((p) => pathname === p);
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

// ── Web Push (Staff PWA P3) ──────────────────────────────────────────────
// The server sends { title, body, url, tag }; show it as a system notification
// even when the app is closed. Tapping focuses an open staff tab or opens `url`.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'Cafe OS';
  const options = {
    body: data.body || '',
    tag: data.tag || 'cafeos',
    icon: '/app.png?v=3',
    badge: '/app.png?v=3',
    data: { url: data.url || '/pos' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/pos';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && 'focus' in w) return w.focus();
      }
      for (const w of wins) {
        if ('focus' in w) { w.navigate(url).catch(() => {}); return w.focus(); }
      }
      return self.clients.openWindow(url);
    }),
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

  // Allow-listed read-only API GETs → stale-while-revalidate so the floor map /
  // notifications stay viewable during a network drop.
  if (isCacheableApi(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached); // offline → serve the last good copy
        return cached || network;
      }),
    );
    return;
  }

  // Everything else (dashboard / admin / other api) → straight to network, untouched.
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
