import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { putImage } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function isValidImageSignature(buf: Buffer, mime: string): boolean {
  if (!buf || buf.length < 12) return false;

  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;

  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

  const isWebp =
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 && // 'RIFF'
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50; // 'WEBP'

  const isGif =
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38; // 'GIF8'

  switch (mime) {
    case 'image/png':
      return isPng;
    case 'image/jpeg':
    case 'image/jpg':
    case 'image/pjpeg':
      return isJpeg;
    case 'image/webp':
      return isWebp;
    case 'image/gif':
      return isGif;
    default:
      return isPng || isJpeg || isWebp || isGif;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 });
  }

  if (session.role !== 'owner' && session.role !== 'manager' && session.role !== 'accountant') {
    return NextResponse.json({ error: 'forbidden', message: 'Insufficient permissions' }, { status: 403 });
  }

  let outletId = session.outletId;
  if (!outletId) {
    const firstOutlet = await prisma.outlet.findFirst({
      where: { tenantId: session.tenantId },
      select: { id: true },
    });
    outletId = firstOutlet?.id ?? null;
  }
  if (!outletId) {
    return NextResponse.json({ error: 'no_outlet', message: 'No outlet configured' }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'upload_failure', message: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('image') || form.get('file') || form.get('logo');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'no_file', message: 'No file provided' }, { status: 400 });
  }

  const mime = (file.type || '').toLowerCase().trim();
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    return NextResponse.json(
      { error: 'unsupported_type', message: 'Supported formats: PNG, JPG/JPEG, WEBP' },
      { status: 415 }
    );
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: 'corrupted_files', message: 'File is empty' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', maxBytes: MAX_BYTES, message: `File size exceeds ${MAX_BYTES / 1024 / 1024}MB limit` },
      { status: 413 }
    );
  }

  const arrayBuf = await file.arrayBuffer().catch(() => null);
  if (!arrayBuf) {
    return NextResponse.json({ error: 'corrupted_files', message: 'Could not read file data' }, { status: 400 });
  }

  const buf = Buffer.from(arrayBuf);

  if (!isValidImageSignature(buf, mime)) {
    return NextResponse.json(
      { error: 'corrupted_files', message: 'Uploaded file is corrupted or not a valid image format.' },
      { status: 400 }
    );
  }

  const name = `${crypto.randomUUID()}.${ext}`;
  const key = `${outletId}/${name}`;

  let url: string;
  try {
    const remoteUrl = await putImage(key, buf, mime);
    if (remoteUrl) {
      url = remoteUrl;
    } else {
      const relativeUploadPath = path.join('uploads', outletId);
      const primaryDir = path.join(process.cwd(), 'public', relativeUploadPath);
      await mkdir(primaryDir, { recursive: true });
      await writeFile(path.join(primaryDir, name), buf);

      // Mirror across monorepo and web public dirs
      const candidatePublicDirs = [
        path.resolve(process.cwd(), '..', 'local-first', 'platform', 'apps', 'web', 'public'),
        path.resolve('c:/nuro 7/CHAYAONE/CHAYAONE OS/local-first/platform/apps/web/public'),
        path.resolve('c:/nuro 7/CHAYAONE/CHAYAONE OS/Owner-chayaone/public'),
      ];

      for (const pubDir of candidatePublicDirs) {
        try {
          if (existsSync(pubDir) && pubDir !== path.join(process.cwd(), 'public')) {
            const destDir = path.join(pubDir, relativeUploadPath);
            await mkdir(destDir, { recursive: true });
            await writeFile(path.join(destDir, name), buf);
          }
        } catch {
          // ignore mirror error
        }
      }

      url = `/uploads/${outletId}/${name}`;
    }
  } catch (err) {
    console.error('[Owner upload] storage failed', err);
    return NextResponse.json(
      { error: 'storage_failure', message: 'Failed to write file to storage' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, url });
}
