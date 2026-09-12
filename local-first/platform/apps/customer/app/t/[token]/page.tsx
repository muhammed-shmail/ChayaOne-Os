import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * Customer Table QR Landing Page
 * Strictly redirects to the canonical ChayaOne Web Customer PWA (/app?t=<token>) on the main platform server.
 */
export default function CustomerTableQrPage({ params }: { params: { token: string } }) {
  const reqHeaders = headers();
  const host = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host') || 'localhost:3003';
  const hostname = host.split(':')[0];
  const proto = reqHeaders.get('x-forwarded-proto') || 'http';
  const webPort = process.env.WEB_PORT || '3000';

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || `${proto}://${hostname}:${webPort}`;

  redirect(`${serverUrl}/app?t=${encodeURIComponent(params.token)}`);
}
