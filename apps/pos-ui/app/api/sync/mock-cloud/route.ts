import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory set of processed event IDs for mock cloud deduplication testing
const processedEvents = new Set<string>();

/**
 * POST /api/sync/mock-cloud
 * Mock Cloud Sync Ingest endpoint for testing local outbox idempotency and sync workers.
 */
export async function POST(req: NextRequest) {
  const eventId = req.headers.get('x-event-id');
  const body = await req.json().catch(() => ({}));

  const effectiveEventId = eventId || body.eventId;
  if (!effectiveEventId) {
    return NextResponse.json({ error: 'missing_event_id' }, { status: 400 });
  }

  // Idempotency check: if event was already processed, return 200 OK (idempotent duplicate)
  if (processedEvents.has(effectiveEventId)) {
    return NextResponse.json({
      status: 'already_processed',
      idempotent: true,
      eventId: effectiveEventId,
    }, { status: 200 });
  }

  // Simulate cloud event processing
  processedEvents.add(effectiveEventId);

  return NextResponse.json({
    status: 'synced',
    idempotent: false,
    eventId: effectiveEventId,
    receivedAt: new Date().toISOString(),
  }, { status: 200 });
}

/**
 * DELETE /api/sync/mock-cloud
 * Reset mock cloud deduplication store (for unit tests).
 */
export async function DELETE() {
  processedEvents.clear();
  return NextResponse.json({ ok: true, reset: true });
}
