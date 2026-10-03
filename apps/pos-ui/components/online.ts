'use client';

/**
 * Read-only offline (Staff PWA P4). The staff app stays viewable during a network
 * drop (cached shell + GET data), but actions that mutate — sending orders,
 * settling bills, bumping tickets — are blocked until the connection returns.
 */
export const OFFLINE_ORDER_MSG = "You're offline — reconnect to send orders";
export const OFFLINE_PAY_MSG = "You're offline — payments are paused";

/** True when the browser reports no network. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
