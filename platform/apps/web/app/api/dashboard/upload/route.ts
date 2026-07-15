import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getSession } from '@/lib/auth';
import { putImage } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboard/upload — owner image upload for PWA banners, featured-dish
 * overrides and the theme logo. Accepts multipart form-data with an `image`
 * file and returns the public URL. Owner/manager only.
 *
 * This is the SINGLE seam for image storage:
 *  - When `SUPABASE_*` is set, the file is uploaded to Supabase Storage and its
 *    CDN URL is what's served — persistent and reliable on ephemeral hosts
 *    (Railway wipes local disk on redeploy, so this is required in production).
 *  - Otherwise it falls back to `public/uploads/<outletId>/<uuid>.<ext>` (local
 *    dev only).
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
  const key = `${session.outletId}/${name}`;

  // Prefer persistent object storage (Supabase); fall back to local disk only
  // when it isn't configured (local dev). A *configured* store that rejects the
  // upload is a hard 502 — we don't silently write to ephemeral local disk.
  let url: string;
  try {
    const remoteUrl = await putImage(key, buf, file.type);
    if (remoteUrl) {
      url = remoteUrl;
    } else {
      const dir = path.join(process.cwd(), 'public', 'uploads', session.outletId);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), buf);
      url = `/uploads/${session.outletId}/${name}`;
    }
  } catch (err) {
    console.error('[upload] storage failed', err);
    return NextResponse.json({ error: 'storage_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, url });
}
