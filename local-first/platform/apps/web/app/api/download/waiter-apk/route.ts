import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  // Check candidate locations for ChayaOne-Waiter.apk
  const candidatePaths = [
    path.resolve(process.cwd(), '..', '..', 'android', 'release-apks', 'ChayaOne-Waiter.apk'),
    path.resolve(process.cwd(), '..', '..', '..', 'android', 'release-apks', 'ChayaOne-Waiter.apk'),
    path.resolve(process.cwd(), 'android', 'release-apks', 'ChayaOne-Waiter.apk'),
    path.resolve(process.cwd(), 'release-apks', 'ChayaOne-Waiter.apk'),
  ];

  let apkPath: string | null = null;
  for (const cand of candidatePaths) {
    if (fs.existsSync(cand)) {
      apkPath = cand;
      break;
    }
  }

  if (!apkPath) {
    return new NextResponse('Waiter Android APK not found on server. Please run BUILD-APKS.bat on the Main PC.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const fileBuffer = fs.readFileSync(apkPath);
    const stat = fs.statSync(apkPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="ChayaOne-Waiter.apk"',
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return new NextResponse(`Error reading APK: ${err.message}`, { status: 500 });
  }
}
