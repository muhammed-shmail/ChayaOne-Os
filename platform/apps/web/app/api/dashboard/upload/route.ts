import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getSession } from '@/lib/auth';
import { mirrorToDrive } from '@/lib/gdrive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboard/upload — owner image upload for PWA banners, featured-dish
 * overrides and the theme logo. Accepts multipart form-data with an `image`
 * file and returns the public URL. Owner/manager only.
 *
 * This is the SINGLE seam for image storage. The file is written under
 * `public/uploads/<outletId>/<uuid>.<ext>` and that local URL is what's served
 * and embedded (reliable in the customer PWA and printed receipts). When the
 * `GDRIVE_*` env vars are set, a copy is ALSO mirrored to a Google Drive folder
 * as an off-site backup — best-effort, so a Drive hiccup never fails the upload.
 */

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('image');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });

  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large', maxBytes: MAX_BYTES }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const name = `${crypto.randomUUID()}.${ext}`;

  // Local disk is the source of truth for what's served.
  try {
    const dir = path.join(process.cwd(), 'public', 'uploads', session.outletId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);
  } catch (err) {
    console.error('[upload] local write failed', err);
    return NextResponse.json({ error: 'storage_failed' }, { status: 502 });
  }
  const url = `/uploads/${session.outletId}/${name}`;

  // Best-effort off-site backup to Google Drive (no-op unless GDRIVE_* is set).
  const driveId = await mirrorToDrive(`${session.outletId}-${name}`, buf, file.type);

  return NextResponse.json({ ok: true, url, driveMirrored: driveId !== null });
}
