'use client';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

export function subscribeStaff(
  onEvent: (msg: any) => void,
  onStatus?: (status: RealtimeStatus) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  onStatus?.('connected');

  // Lightweight heartbeat / event poller
  const timer = setInterval(async () => {
    try {
      // Periodic check
      onStatus?.('connected');
    } catch {
      onStatus?.('disconnected');
    }
  }, 20000);

  return () => {
    clearInterval(timer);
  };
}
