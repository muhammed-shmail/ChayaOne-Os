import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getSession } from '@/lib/auth';
import { hasRole, hasPermission } from '@/lib/rbac';
import { putImage } from '@/lib/storage';
import { prisma } from '@cafeos/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboard/upload — image upload for store logo, PWA banners,
 * and featured dishes.
 *
 * Supports PNG, JPG/JPEG, WEBP, SVG, GIF, AVIF up to 10MB.
 * Features content-based magic-byte sniffing to accept valid images even
 * when client MIME types or file extensions are generic or mismatched.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/x-png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/jfif': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/svg': 'svg',
  'image/avif': 'avif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
};

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
};

interface DetectedImage {
  valid: boolean;
  ext: string;
  mime: string;
}

/**
 * Robust image detector: inspects magic bytes / file signatures directly
 * instead of rigidly trusting client-provided MIME headers (which are frequently
 * wrong or generic in Windows browsers).
 */
function detectImage(buf: Buffer, clientMime?: string, fileName?: string): DetectedImage {
  if (!buf || buf.length < 4) {
    return { valid: false, ext: '', mime: '' };
  }

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { valid: true, ext: 'png', mime: 'image/png' };
  }

  // 2. JPEG: FF D8
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) {
    return { valid: true, ext: 'jpg', mime: 'image/jpeg' };
  }

  // 3. WebP: RIFF .... WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { valid: true, ext: 'webp', mime: 'image/webp' };
  }

  // 4. GIF: GIF87a or GIF89a
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return { valid: true, ext: 'gif', mime: 'image/gif' };
  }

  // 5. BMP: BM
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return { valid: true, ext: 'bmp', mime: 'image/bmp' };
  }

  // 6. ICO: 00 00 01 00
  if (buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) {
    return { valid: true, ext: 'ico', mime: 'image/x-icon' };
  }

  // 7. AVIF: ....ftypavif
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') {
      return { valid: true, ext: 'avif', mime: 'image/avif' };
    }
  }

  // 8. SVG: Text containing <svg
  const headText = buf.subarray(0, Math.min(buf.length, 4096)).toString('utf8').trim().toLowerCase();
  if (
    headText.startsWith('<svg') ||
    headText.startsWith('<?xml') ||
    headText.includes('<svg') ||
    headText.includes('xmlns="http://www.w3.org/2000/svg"') ||
    headText.includes('<!doctype svg')
  ) {
    if (headText.includes('<svg') || buf.toString('utf8').toLowerCase().includes('</svg>')) {
      return { valid: true, ext: 'svg', mime: 'image/svg+xml' };
    }
  }

  // 9. Fallback: Check client-supplied MIME or file extension if byte sniffing didn't match
  const rawMime = ((clientMime || '').split(';')[0] ?? '').toLowerCase().trim();
  const extFromName = fileName ? path.extname(fileName).toLowerCase().replace('.', '').trim() : '';

  if (EXT_BY_MIME[rawMime]) {
    const ext = EXT_BY_MIME[rawMime];
    return { valid: true, ext, mime: rawMime };
  }

  if (rawMime.startsWith('image/')) {
    const sub = rawMime.replace('image/', '').replace('x-', '').replace('vnd.microsoft.', '');
    const mappedExt = sub === 'jpeg' || sub === 'jfif' || sub === 'pjpeg' ? 'jpg' : sub === 'svg+xml' ? 'svg' : sub;
    return { valid: true, ext: mappedExt, mime: rawMime };
  }

  if (MIME_BY_EXT[extFromName]) {
    return { valid: true, ext: extFromName === 'jpeg' || extFromName === 'jfif' ? 'jpg' : extFromName, mime: MIME_BY_EXT[extFromName] };
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'avif', 'ico', 'bmp', 'jfif'].includes(extFromName)) {
    const ext = extFromName === 'jpeg' || extFromName === 'jfif' ? 'jpg' : extFromName;
    return { valid: true, ext, mime: `image/${ext === 'jpg' ? 'jpeg' : ext}` };
  }

  return { valid: false, ext: '', mime: '' };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 });
  }

  // Authorization: Owner, Manager, Accountant or staff with settings:general permission
  if (!hasRole(session, ['owner', 'manager', 'accountant', 'admin']) && !hasPermission(session, 'settings:general')) {
    return NextResponse.json({ error: 'forbidden', message: 'Insufficient permissions' }, { status: 403 });
  }

  // Resolve outletId — owner/manager accounts may not have one bound in their JWT
  let outletId: string | null = session.outletId;
  if (!outletId) {
    const firstOutlet = await prisma.outlet.findFirst({
      where: { tenantId: session.tenantId },
      select: { id: true },
    });
    outletId = firstOutlet?.id ?? null;
  }
  // Local-first single outlet fallback
  if (!outletId) {
    const fallbackOutlet = await prisma.outlet.findFirst({ select: { id: true } });
    outletId = fallbackOutlet?.id ?? null;
  }
  if (!outletId) {
    return NextResponse.json({ error: 'no_outlet', message: 'No outlet configured in database' }, { status: 400 });
  }

  const form = await req.formData().catch((err) => {
    console.error('[Upload] req.formData() failed:', err);
    return null;
  });
  if (!form) {
    return NextResponse.json({ error: 'upload_failure', message: 'Invalid form-data payload' }, { status: 400 });
  }

  // Support common field keys: 'image', 'file', 'logo', 'upload', 'photo' or first valid file in form
  let file = form.get('image') || form.get('file') || form.get('logo') || form.get('upload') || form.get('photo');
  if (!file) {
    for (const value of form.values()) {
      if (value && typeof value === 'object' && typeof (value as any).arrayBuffer === 'function') {
        file = value;
        break;
      }
    }
  }

  if (!file || typeof file === 'string' || typeof (file as any).arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'no_file', message: 'No image file provided' }, { status: 400 });
  }

  const blobFile = file as unknown as { size: number; type?: string; name?: string; arrayBuffer: () => Promise<ArrayBuffer> };

  if (blobFile.size <= 0) {
    return NextResponse.json({ error: 'corrupted_files', message: 'File is empty (0 bytes)' }, { status: 400 });
  }

  if (blobFile.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', maxBytes: MAX_BYTES, message: `File size exceeds ${MAX_BYTES / 1024 / 1024}MB limit` },
      { status: 413 }
    );
  }

  const arrayBuf = await blobFile.arrayBuffer().catch(() => null);
  if (!arrayBuf) {
    return NextResponse.json({ error: 'corrupted_files', message: 'Could not read file data' }, { status: 400 });
  }

  const buf = Buffer.from(arrayBuf);
  const detected = detectImage(buf, blobFile.type, blobFile.name);

  if (!detected.valid) {
    return NextResponse.json(
      { error: 'corrupted_files', message: 'Uploaded file is not a supported image (PNG, JPG, WEBP, SVG, GIF, AVIF).' },
      { status: 400 }
    );
  }

  const ext = detected.ext;
  const mime = detected.mime;
  const name = `${crypto.randomUUID()}.${ext}`;
  const key = `${outletId}/${name}`;

  let url: string | null = null;
  try {
    const remoteUrl = await putImage(key, buf, mime).catch((err) => {
      console.warn('[upload] Remote storage failed, falling back to local storage:', err?.message || err);
      return null;
    });
    if (remoteUrl) {
      url = remoteUrl;
    }
  } catch (err) {
    console.warn('[upload] Remote storage exception, using local fallback:', err);
  }

  if (!url) {
    try {
      // Local persistent storage
      const relativeUploadPath = path.join('uploads', outletId);
      const cwd = process.cwd();
      const primaryDir = path.join(cwd, 'public', relativeUploadPath);
      await mkdir(primaryDir, { recursive: true });
      await writeFile(path.join(primaryDir, name), buf);

      // Mirror to candidate public upload directories across monorepo, web, desktop, and apps
      const candidatePublicDirs = [
        path.resolve(cwd, 'public'),
        path.resolve(cwd, 'apps', 'web', 'public'),
        path.resolve(cwd, '..', 'apps', 'web', 'public'),
        path.resolve(cwd, '..', 'web', 'public'),
        path.resolve(cwd, '..', 'waiter', 'public'),
        path.resolve(cwd, '..', 'customer', 'public'),
        path.resolve(cwd, '..', '..', 'Owner-chayaone', 'public'),
        path.resolve(cwd, '..', '..', '..', 'Owner-chayaone', 'public'),
        path.resolve(cwd, 'apps', 'desktop', 'bundle', 'web-server', 'public'),
        path.resolve(cwd, '..', 'desktop', 'bundle', 'web-server', 'public'),
        path.resolve(cwd, '..', '..', 'apps', 'desktop', 'bundle', 'web-server', 'public'),
      ];

      for (const pubDir of candidatePublicDirs) {
        try {
          if (existsSync(pubDir)) {
            const destDir = path.join(pubDir, relativeUploadPath);
            await mkdir(destDir, { recursive: true });
            await writeFile(path.join(destDir, name), buf);
          }
        } catch {
          // Non-blocking mirror error
        }
      }

      url = `/uploads/${outletId}/${name}`;
    } catch (err: any) {
      console.error('[upload] local storage write failed', err);
      return NextResponse.json(
        { error: 'storage_failure', message: err?.message || 'Failed to write file to storage' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, url });
}
