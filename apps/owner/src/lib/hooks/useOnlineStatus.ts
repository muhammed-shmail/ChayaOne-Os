'use client';

import { useEffect, useState } from 'react';

/**
 * Hook that tracks the browser's online/offline status.
 * Fires the online/offline events for reconnect detection.
 */
export function useOnlineStatus(): {
  isOnline:   boolean;
  justCameOnline: boolean;
} {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [justCameOnline, setJustCameOnline] = useState(false);

  useEffect(() => {
    function onOnline() {
      setIsOnline(true);
      setJustCameOnline(true);
      // Reset the "just came online" flag after 3 seconds
      setTimeout(() => setJustCameOnline(false), 3000);
    }
    function onOffline() {
      setIsOnline(false);
      setJustCameOnline(false);
    }

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { isOnline, justCameOnline };
}
