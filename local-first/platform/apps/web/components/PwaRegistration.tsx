'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function PwaRegistration() {
  const pathname = usePathname();

  useEffect(() => {
    const isDesktopOrNative = typeof window !== 'undefined' && (
      window.navigator.userAgent.includes('Electron') ||
      !!(window as any).electronAPI ||
      !!(window as any).chayaOne ||
      !!(window as any).AndroidBridge
    );

    // 1. In Electron / Native app, disable service worker to avoid chunk caching conflicts
    if (isDesktopOrNative) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
        if ('caches' in window) {
          caches.keys().then((keys) => {
            for (const key of keys) caches.delete(key);
          });
        }
      }
    } else if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      // Register Service Worker for mobile browser PWA only
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered with scope:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
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
