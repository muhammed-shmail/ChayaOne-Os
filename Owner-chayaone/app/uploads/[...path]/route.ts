import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  const segments = params.path ?? [];
  if (segments.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Prevent path traversal
  for (const seg of segments) {
    if (seg.includes('..') || seg.includes('/') || seg.includes('\\')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const relativePath = segments.join(path.sep);

  const cwd = process.cwd();
  const candidateDirs = [
    path.join(cwd, 'public', 'uploads'),
    path.resolve(cwd, '..', 'local-first', 'platform', 'apps', 'web', 'public', 'uploads'),
    path.resolve(cwd, 'apps', 'web', 'public', 'uploads'),
  ];

  let targetFile: string | null = null;
  for (const dir of candidateDirs) {
    const fullPath = path.join(dir, relativePath);
    if (existsSync(fullPath)) {
      targetFile = fullPath;
      break;
    }
  }

  if (!targetFile) {
    return new NextResponse('File not found', { status: 404 });
  }

  try {
    const data = await readFile(targetFile);
    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[Owner uploads handler] error serving file:', err);
    return new NextResponse('Error serving file', { status: 500 });
  }
}
