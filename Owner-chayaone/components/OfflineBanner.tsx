'use client';

import { useEffect, useState } from 'react';

/**
 * A slim, high-contrast strip shown across the top of the staff app when the
 * device loses network (Staff PWA P4). The app stays usable for viewing (cached
 * shell + GET data); this makes the offline state unmissable and signals that
 * orders/payments are paused. Recovers on the browser 'online' event or an
 * active probe (covers flaky events / captive portals).
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    // While the browser reports offline, probe a tiny same-origin asset so we
    // flip back the moment connectivity returns even if no 'online' event fires.
    const probe = async () => {
      if (navigator.onLine) { setOffline(false); return; }
      try {
        await fetch('/staff.webmanifest', { method: 'HEAD', cache: 'no-store' });
        setOffline(false);
      } catch {
        setOffline(true);
      }
    };
    const id = window.setInterval(() => { if (!navigator.onLine) probe(); }, 8000);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.clearInterval(id);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[900] text-center text-[12.5px] font-semibold text-white"
      style={{ background: '#B4431F', paddingTop: 'calc(env(safe-area-inset-top) + 4px)', paddingBottom: '4px' }}
    >
      Offline — reconnecting… Orders &amp; payments are paused.
    </div>
  );
}
