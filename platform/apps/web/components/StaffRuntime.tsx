'use client';

import { useEffect, useState } from 'react';

/**
 * Client runtime mounted on the staff surfaces (POS / KDS) and the dashboard.
 *
 *  - Keep-alive: pings /api/auth/refresh on mount, on tab focus, and every ~15 min
 *    so the short access token (and the device's lastSeenAt presence) never lapses
 *    while the app is open — staff "stay logged in". A 401 means the device was
 *    revoked or expired → bounce to /login.
 *  - PWA (pos/kds only): registers the service worker and offers an "Add to Home
 *    Screen" install banner so staff can install the app on their own phones.
 */
const KEEPALIVE_MS = 15 * 60 * 1000; // well under the 30-min access TTL
const DISMISS_KEY = 'cafeos_staff_install_dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

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

  // ---- install banner ----
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (!pwa) return;
    if (typeof window === 'undefined') return;
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return; // already installed
    try { if (localStorage.getItem(DISMISS_KEY) === '1') return; } catch { /* ignore */ }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS Safari never fires beforeinstallprompt → show a manual Add-to-Home hint.
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua)) {
      setIosHint(true);
      setShow(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [pwa]);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch { /* ignore */ }
    setDeferred(null);
    dismiss();
  };

  if (!pwa || !show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#0E0B08] px-4 py-3 text-white shadow-lg">
      <div className="flex-1 text-sm leading-snug">
        {iosHint ? (
          <>Install this app: tap <span className="font-semibold">Share</span> then <span className="font-semibold">Add to Home Screen</span>.</>
        ) : (
          <>Install <span className="font-semibold">Cafe Staff</span> on your phone for one-tap access.</>
        )}
      </div>
      {!iosHint && (
        <button
          onClick={install}
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#0E0B08]"
        >
          Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-white/60 hover:text-white">✕</button>
    </div>
  );
}
