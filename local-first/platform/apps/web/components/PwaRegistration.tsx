'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function PwaRegistration() {
  const pathname = usePathname();

  useEffect(() => {
    // 1. Register Service Worker (ONLY IN PRODUCTION)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered with scope:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    } else if ('serviceWorker' in navigator) {
      // Unregister any existing service workers in dev mode to fix caching issues
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      });
    }

    // 2. Dynamically set manifest link in <head> without polluting React VDOM
    try {
      const manifestUrl = (pathname.startsWith('/pos') || pathname.startsWith('/approvals') || pathname.startsWith('/kds'))
        ? '/manifest-waiter.json'
        : '/manifest-customer.json';

      let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
      }
      link.href = manifestUrl;
    } catch {
      // ignore in environments without DOM
    }
  }, [pathname]);

  return null;
}
