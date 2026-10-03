import { NextResponse } from 'next/server';
import { backupManager } from '@/lib/system/backup-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const backups = await backupManager.listBackups();
    return NextResponse.json({ backups });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list backups' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action || 'create';

    if (action === 'create') {
      const type = body.type || 'MANUAL';
      const backup = await backupManager.createBackup({ type });
      return NextResponse.json({
        success: true,
        message: 'Backup generated successfully',
        backup,
      });
    }

    if (action === 'restore') {
      const backupId = body.backupId;
      if (!backupId) {
        return NextResponse.json({ error: 'backupId is required for restore' }, { status: 400 });
      }
      const result = await backupManager.restoreBackup(backupId);
      return NextResponse.json(result);
    }

    if (action === 'validate') {
      const backupId = body.backupId;
      if (!backupId) {
        return NextResponse.json({ error: 'backupId is required for validation' }, { status: 400 });
      }
      const isValid = await backupManager.validateBackup(backupId);
      return NextResponse.json({ isValid });
    }

    return NextResponse.json({ error: 'Invalid backup action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Backup operation failed' }, { status: 500 });
  }
}
