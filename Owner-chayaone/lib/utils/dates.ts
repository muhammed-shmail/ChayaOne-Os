/**
 * Date helpers for the Owner Dashboard.
 * All timestamps should use the outlet's timezone (default: Asia/Kolkata).
 */

export const DEFAULT_TZ = 'Asia/Kolkata';

/** Format a Date or ISO string to "2:15 PM" */
export function formatTime(ts: Date | string, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  }).format(new Date(ts));
}

/** Format to "10 Sep 2026" */
export function formatDate(ts: Date | string, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: tz,
  }).format(new Date(ts));
}

/** Format to "10 Sep 2026, 2:15 PM" */
export function formatDateTime(ts: Date | string, tz = DEFAULT_TZ): string {
  return `${formatDate(ts, tz)}, ${formatTime(ts, tz)}`;
}

/** Relative time: "2 minutes ago", "just now" */
export function timeAgo(ts: Date | string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const d = Math.floor(hr / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** ISO date string for today in a given timezone: "2026-09-10" */
export function todayISO(tz = DEFAULT_TZ): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/** Date range presets */
export function getDateRange(preset: 'today' | 'yesterday' | 'week' | 'month' | 'last_month'): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { from: today, to: now };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: y, to: today };
    }
    case 'week': {
      const w = new Date(today);
      w.setDate(w.getDate() - 6);
      return { from: w, to: now };
    }
    case 'month': {
      const m = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: m, to: now };
    }
    case 'last_month': {
      const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
      return { from: lmStart, to: lmEnd };
    }
  }
}
