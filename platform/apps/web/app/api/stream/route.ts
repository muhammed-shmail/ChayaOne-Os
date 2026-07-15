import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rollFromRefresh, setAuthCookies } from '@/lib/staff-session';
import { subscribe, type RealtimeEvent } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/stream — Server-Sent Events for the current staff member's outlet.
 * The KDS / POS / approvals dashboard / owner monitor subscribe here. EventSource
 * sends the session cookie automatically, so we scope the stream to that outlet.
 *
 * Auth is resilient by design: the access token is short (30 min) but this
 * connection is long-lived, so we accept a valid refresh cookie when the access
 * token has lapsed and hand back a fresh access cookie. Without this a single
 * 401 permanently kills the EventSource (no auto-retry) and the live feed sticks
 * on "Offline" until a full page reload.
 */
export async function GET(req: NextRequest) {
  let outletId: string | null = null;
  let renewed: { access: string; refresh: string } | null = null;

  const session = await getSession();
  if (session) {
    outletId = session.outletId;
  } else {
    const rolled = await rollFromRefresh(req);
    if (rolled) {
      outletId = rolled.principal.outletId;
      renewed = { access: rolled.access, refresh: rolled.refresh };
    }
  }
  if (!outletId) return new Response('unauthorized', { status: 401 });

  const enc = new TextEncoder();
  let unsub: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* closed */
        }
      };

      send({ type: 'hello', outletId });

      unsub = subscribe(outletId!, (e: RealtimeEvent) => send(e));

      // comment ping keeps proxies from killing the idle connection
      ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        unsub?.();
        if (ping) clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsub?.();
      if (ping) clearInterval(ping);
    },
  });

  const res = new NextResponse(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
  // If we authorized via the refresh cookie, refresh the access cookie so the
  // rest of the app (and the next reconnect) sees a valid short token again.
  if (renewed) setAuthCookies(res, renewed.access, renewed.refresh);
  return res;
}
