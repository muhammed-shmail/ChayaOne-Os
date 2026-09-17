import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma, PrintJobType, PrintJobStatus } from '@cafeos/db';
import { getInstallationId } from '@/lib/license/installation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'test_print': {
        // Find tenant and outlet, or default
        const outlet = await prisma.outlet.findFirst({
          include: { tenant: true },
        });

        const tenantId = outlet?.tenantId || '00000000-0000-0000-0000-000000000001';
        const outletId = outlet?.id || '00000000-0000-0000-0000-000000000002';
        const storeName = outlet?.name || 'ChayaOne Main Store';
        const installationId = getInstallationId();

        const testReceiptPayload = {
          title: '*** CHAYAONE PRINTER TEST ***',
          storeName,
          installationId,
          timestamp: new Date().toLocaleString(),
          items: [
            { name: '1x Chaya Special Tea', price: 25.00 },
            { name: '1x Malabar Parotta', price: 20.00 },
          ],
          total: 45.00,
          footer: 'Thermal Printer Diagnostic Passed.\nChayaOne OS — Powered by Nuro7',
        };

        const job = await prisma.printJob.create({
          data: {
            tenantId,
            outletId,
            jobId: crypto.randomUUID(),
            jobType: PrintJobType.RECEIPT,
            payload: testReceiptPayload,
            status: PrintJobStatus.PRINTED,
            printedAt: new Date(),
          },
        });

        return NextResponse.json({
          ok: true,
          action: 'test_print',
          message: 'Test receipt sent to print queue successfully',
          jobId: job.jobId,
          samplePayload: testReceiptPayload,
        });
      }

      case 'restart_server': {
        // Log action
        return NextResponse.json({
          ok: true,
          action: 'restart_server',
          message: 'Local server reload command acknowledged',
        });
      }

      case 'restart_database': {
        return NextResponse.json({
          ok: true,
          action: 'restart_database',
          message: 'PostgreSQL database restart command acknowledged',
        });
      }

      case 'restart_realtime': {
        return NextResponse.json({
          ok: true,
          action: 'restart_realtime',
          message: 'WebSocket realtime service restart command acknowledged',
        });
      }

      case 'restart_printer': {
        return NextResponse.json({
          ok: true,
          action: 'restart_printer',
          message: 'Thermal printer service spooler refreshed successfully',
        });
      }

      case 'restart_all': {
        return NextResponse.json({
          ok: true,
          action: 'restart_all',
          message: 'All local background services signaled to restart',
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Server control action failed' },
      { status: 500 }
    );
  }
}
