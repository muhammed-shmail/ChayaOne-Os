import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * /waiter — Dedicated Waiter entry point.
 * Preserves query params (?server=...&port=...&user=...) and redirects to /pos.
 */
export default function WaiterRedirectPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams || {})) {
    if (typeof val === 'string') query.set(key, val);
    else if (Array.isArray(val) && val[0]) query.set(key, val[0]);
  }
  const qs = query.toString();
  redirect(`/pos${qs ? `?${qs}` : ''}`);
}

