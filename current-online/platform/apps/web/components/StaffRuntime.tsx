'use client';

import { useEffect, useState } from 'react';
import { useStaffInstall } from '@/components/staff-install';

/**
 * Client runtime mounted on the staff surfaces (POS / KDS) and the dashboard.
 *
 *  - Keep-alive: pings /api/auth/refresh on mount, on tab focus, and every ~15 min
 *    so the short access token (and the device's lastSeenAt presence) never lapses
 *    while the app is open — staff "stay logged in". A 401 means the device was
 *    revoked or expired → bounce to /login.
 *  - PWA (pos/kds only): registers the service worker, offers an "Add to Home
 *    Screen" install banner, and an "Enable alerts" prompt that subscribes the
 *    device to Web Push (so order/broadcast alerts arrive when the app is closed).
 *    Push + SW only run in production (the SW isn't registered in dev).
 */
const KEEPALIVE_MS = 15 * 60 * 1000; // well under the 30-min access TTL
const INSTALL_DISMISS_KEY = 'cafeos_staff_install_dismissed';
const ALERTS_DISMISS_KEY = 'cafeos_staff_alerts_dismissed';

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Ensure this device has a Web Push subscription registered server-side. */
async function ensurePushSubscription(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const res = await fetch('/api/staff/push/key', { cache: 'no-store' });
    const { key, configured } = await res.json();
    if (!configured || !key) return false;
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) as BufferSource });
  }
  await fetch('/api/staff/push/subscribe', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub),
  });
  return true;
}

export default function StaffRuntime({ pwa = false }: { pwa?: boolean }) {
  // ---- session keep-alive ----
  useEffect(() => {
    let stop = false;
    const ping = async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST', cache: 'no-store' });
        if (res.status === 401 && !stop) window.location.assign('/login');
      } catch {
        /* offline — middleware/refresh will sort it out on the next real navigation */
      }
    };
    ping();
    const onVisible = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(ping, KEEPALIVE_MS);
    return () => { stop = true; document.removeEventListener('visibilitychange', onVisible); window.clearInterval(id); };
  }, []);

  // ---- service worker registration (pos/kds, production only) ----
  useEffect(() => {
    if (!pwa) return;
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, [pwa]);

  // ---- install banner (shared state so the POS/KDS menu buttons trigger the same prompt) ----
  const { available, iosHint, reveal, promptInstall } = useStaffInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(INSTALL_DISMISS_KEY) === '1') setDismissed(true); } catch { /* ignore */ }
  }, []);
  // A menu-button tap without a native prompt (iOS) bumps `reveal` → un-dismiss so
  // the Share → Add to Home Screen hint comes back even after it was closed.
  useEffect(() => {
    if (reveal > 0) {
      setDismissed(false);
      try { localStorage.removeItem(INSTALL_DISMISS_KEY); } catch { /* ignore */ }
    }
  }, [reveal]);

  const dismissInstall = () => {
    setDismissed(true);
    try { localStorage.setItem(INSTALL_DISMISS_KEY, '1'); } catch { /* ignore */ }
  };
  const install = async () => { await promptInstall(); dismissInstall(); };

  // ---- push alerts ----
  // 'unsupported' until we confirm support in prod; then mirrors Notification.permission.
  const [pushState, setPushState] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('unsupported');
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [alertsDismissed, setAlertsDismissed] = useState(false);

  useEffect(() => {
    if (!pwa || typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return; // push needs the SW, dev-skipped
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try { if (localStorage.getItem(ALERTS_DISMISS_KEY) === '1') setAlertsDismissed(true); } catch { /* ignore */ }
    const perm = Notification.permission as 'default' | 'granted' | 'denied';
    setPushState(perm);
    if (perm === 'granted') ensurePushSubscription().catch(() => {});
  }, [pwa]);

  const enableAlerts = async () => {
    setAlertsBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPushState(perm as 'default' | 'granted' | 'denied');
      if (perm === 'granted') await ensurePushSubscription();
    } catch { /* ignore */ } finally { setAlertsBusy(false); }
  };
  const dismissAlerts = () => {
    setAlertsDismissed(true);
    try { localStorage.setItem(ALERTS_DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const showInstall = pwa && available && !dismissed;
  const showAlerts = pwa && pushState === 'default' && !alertsDismissed;
  if (!showInstall && !showAlerts) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md flex-col gap-2">
      {showAlerts && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#0E0B08] px-4 py-3 text-white shadow-lg">
          <div className="flex-1 text-sm leading-snug">Turn on alerts so you don’t miss new orders.</div>
          <button onClick={enableAlerts} disabled={alertsBusy} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#0E0B08] disabled:opacity-60">
            {alertsBusy ? '…' : 'Enable'}
          </button>
          <button onClick={dismissAlerts} aria-label="Dismiss" className="shrink-0 text-white/60 hover:text-white">✕</button>
        </div>
      )}
      {showInstall && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#0E0B08] px-4 py-3 text-white shadow-lg">
          <div className="flex-1 text-sm leading-snug">
            {iosHint ? (
              <>Install this app: tap <span className="font-semibold">Share</span> then <span className="font-semibold">Add to Home Screen</span>.</>
            ) : (
              <>Install <span className="font-semibold">Cafe Staff</span> on your phone for one-tap access.</>
            )}
          </div>
          {!iosHint && (
            <button onClick={install} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#0E0B08]">Install</button>
          )}
          <button onClick={dismissInstall} aria-label="Dismiss" className="shrink-0 text-white/60 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}
