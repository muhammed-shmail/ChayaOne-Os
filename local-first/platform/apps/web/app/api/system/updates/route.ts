import { NextResponse } from 'next/server';
import { updateManager } from '@/lib/system/update-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const state = updateManager.getState();
  const busyStatus = await updateManager.isCafeInActiveOperation();

  return NextResponse.json({
    ...state,
    isCafeBusy: busyStatus.isBusy,
    activeOrders: busyStatus.activeOrderCount,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action || 'check';

    if (action === 'check') {
      const channel = body.channel || 'stable';
      const result = await updateManager.checkForUpdates(channel);
      return NextResponse.json(result);
    }

    if (action === 'apply') {
      const manifest = body.manifest;
      const forceDuringBusyHours = !!body.forceDuringBusyHours;
      const result = await updateManager.applyUpdate({ manifest, forceDuringBusyHours });
      return NextResponse.json(result);
    }

    if (action === 'schedule') {
      const state = updateManager.getState();
      return NextResponse.json({
        success: true,
        message: 'Update scheduled to install automatically after business hours closing.',
        scheduledVersion: state.targetVersion || state.manifest?.version,
      });
    }

    return NextResponse.json({ error: 'Invalid update action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Update operation failed' }, { status: 500 });
  }
}
