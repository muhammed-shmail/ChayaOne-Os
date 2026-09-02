import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * /waiter — Redirect to Waiter Approvals & Floor workspace.
 */
export default function WaiterRedirectPage() {
  redirect('/approvals');
}
