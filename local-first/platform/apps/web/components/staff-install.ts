'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Staff-app install state — a module-level singleton shared by the StaffRuntime
 * bottom banner AND the "Install the Staff App" buttons in the POS / KDS menus.
 *
 * The browser fires `beforeinstallprompt` exactly once and only one holder can
 * call `.prompt()`, so both surfaces must read the SAME deferred event — hence a
 * globalThis singleton (mirrors `staff-feed.ts`) rather than per-component state.
 *
 * Android/Chromium: we stash the deferred prompt and replay it on demand.
 * iOS Safari: there is no install API, so `promptInstall()` bumps `reveal`, which
 * nudges the StaffRuntime banner (with the manual "Share → Add to Home Screen"
 * hint) back into view even if it was previously dismissed.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type State = {
  canPrompt: boolean; // a deferred beforeinstallprompt is held (Android/Chromium)
  installed: boolean; // running standalone → already on the home screen
  isIos: boolean;     // iOS Safari, where install is a manual Share → A2HS
  reveal: number;     // bumped by promptInstall() on iOS to re-open the banner
};

const EMPTY: State = { canPrompt: false, installed: false, isIos: false, reveal: 0 };

const g = globalThis as unknown as {
  __cafeStaffInstall?: {
    state: State; deferred: BeforeInstallPromptEvent | null;
    started: boolean; listeners: Set<() => void>;
  };
};
const store = g.__cafeStaffInstall ?? (g.__cafeStaffInstall = {
  state: EMPTY, deferred: null, started: false, listeners: new Set(),
});

function emit() { for (const l of store.listeners) l(); }
function setState(patch: Partial<State>) { store.state = { ...store.state, ...patch }; emit(); }

function detectInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function start() {
  if (store.started || typeof window === 'undefined') return;
  store.started = true;

  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
  setState({ installed: detectInstalled(), isIos });

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    store.deferred = e as BeforeInstallPromptEvent;
    setState({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    store.deferred = null;
    setState({ canPrompt: false, installed: true });
  });
}

/** Trigger install: native prompt on Android; reveal the manual iOS hint otherwise. */
export async function promptInstall(): Promise<void> {
  const d = store.deferred;
  if (d) {
    try { await d.prompt(); await d.userChoice; } catch { /* user dismissed / unsupported */ }
    store.deferred = null;
    setState({ canPrompt: false });
    return;
  }
  setState({ reveal: store.state.reveal + 1 });
}

function subscribe(cb: () => void) { store.listeners.add(cb); return () => store.listeners.delete(cb); }
function getSnapshot() { return store.state; }
function getServerSnapshot() { return EMPTY; }

/**
 * Subscribe to the shared install state.
 *  - `available` — worth offering install (not installed, and either a deferred
 *    Android prompt is ready OR we're on iOS Safari).
 *  - `iosHint` — install must be done manually (show Share → Add to Home Screen).
 *  - `reveal` — increments when promptInstall() is called without a deferred prompt.
 */
export function useStaffInstall() {
  useEffect(() => { start(); }, []);
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    available: !state.installed && (state.canPrompt || state.isIos),
    installed: state.installed,
    iosHint: state.isIos && !state.canPrompt,
    reveal: state.reveal,
    promptInstall,
  };
}
