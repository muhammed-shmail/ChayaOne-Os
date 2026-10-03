import { NextRequest, NextResponse } from 'next/server';
import { resolveTable, resolveCustomerId } from '@/lib/customer';
import { createNotification } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/customer/feedback
 * Public customer endpoint to submit ratings and feedback for their table visit.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.t) {
    return NextResponse.json({ error: 'missing_qr_token' }, { status: 400 });
  }

  const table = await resolveTable(body.t);
  if (!table) {
    return NextResponse.json({ error: 'table_not_found' }, { status: 404 });
  }

  const rating = Math.max(1, Math.min(5, Math.floor(Number(body.rating || 5))));
  const comments = body.comments ? String(body.comments).slice(0, 500) : null;
  const tags = Array.isArray(body.tags) ? body.tags.slice(0, 10) : [];
  const outletId = table.outlet.id;

  try {
    // Notify owner/manager of customer feedback
    await createNotification({
      outletId,
      type: 'customer.feedback',
      severity: rating >= 4 ? 'info' : 'warn',
      title: `⭐ ${rating}-Star Review from Table ${table.label}`,
      body: comments ? `${comments} (${tags.join(', ')})` : `Customer rated ${rating}/5 stars.`,
      entity: 'TableMap',
      entityId: table.id,
      audience: 'owner',
      meta: {
        tableId: table.id,
        tableLabel: table.label,
        rating,
        comments,
        tags,
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'Thank you for your feedback! We look forward to serving you again.',
    });
  } catch (err: any) {
    console.error('[CUSTOMER FEEDBACK ERROR]', err);
    return NextResponse.json({ error: 'feedback_failed', message: err.message }, { status: 500 });
  }
}
