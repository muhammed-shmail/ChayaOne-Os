import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * /waiter — Redirect to Waiter POS till.
 */
export default function WaiterRedirectPage() {
  redirect('/pos');
}

