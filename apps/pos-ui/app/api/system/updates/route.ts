import { NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let isCafeBusy = false;
  let activeOrders = 0;

  try {
    activeOrders = await prisma.order.count({
      where: {
        status: { in: ['open', 'pending_approval', 'approved', 'in_kitchen', 'ready', 'served'] },
      },
    });
    isCafeBusy = activeOrders > 0;
  } catch {
    // If database is not reachable, default to false
  }

  const currentVersion = process.env.CHAYAONE_APP_VERSION || '0.1.0';

  return NextResponse.json({
    state: 'IDLE',
    currentVersion,
    channel: 'stable',
    provider: 'github',
    isCafeBusy,
    activeOrders,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'check';

    if (action === 'check') {
      const currentVersion = process.env.CHAYAONE_APP_VERSION || '0.1.0';
      return NextResponse.json({
        updateAvailable: false,
        message: `Current version is v${currentVersion}. Native updates are managed via GitHub Releases.`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Operation failed' }, { status: 500 });
  }
}
