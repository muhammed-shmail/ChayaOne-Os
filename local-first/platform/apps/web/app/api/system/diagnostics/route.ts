import { NextResponse } from 'next/server';
import { diagnosticsEngine } from '@/lib/system/diagnostics-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const report = await diagnosticsEngine.runFullDiagnostics();
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Diagnostics scan failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action || 'report';

    if (action === 'report') {
      const report = await diagnosticsEngine.generateSupportReport();
      return NextResponse.json(report);
    }

    return NextResponse.json({ error: 'Invalid diagnostics action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to generate report' }, { status: 500 });
  }
}
