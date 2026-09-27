/**
 * Cafe OS — Logo Raster Engine for ESC/POS Thermal Printing.
 *
 * Downloads the store logo from a URL and encodes it as an ESC/POS
 * GS v 0 raster bit-image buffer, ready to be prepended to the
 * receipt ESC/POS buffer so the logo prints at the very top of the bill.
 *
 * Pipeline:
 *   URL  →  fetch()  →  Jimp (resize + greyscale + contrast)
 *        →  1-bit bitmap row-by-row  →  GS v 0 m xL xH yL yH d1…dk
 *
 * Works with any printer that supports GS v 0 raster command
 * (TVSE RP3200 Lite/Plus, Epson TM-T82/T88, Star, etc.)
 */

import fs from 'node:fs';
import path from 'node:path';
import { Jimp } from 'jimp';

/** Maximum logo width in printer dots (80mm @ 203dpi ≈ 576 dots, 58mm ≈ 384 dots). */
const LOGO_MAX_WIDTH_80MM = 380; // ~48mm — centered on 576-dot wide paper
const LOGO_MAX_WIDTH_58MM = 260; // ~33mm — centered on 384-dot wide paper

/** Maximum logo height in dots (~20mm for 80mm, ~16mm for 58mm). */
const LOGO_MAX_HEIGHT_80MM = 160;
const LOGO_MAX_HEIGHT_58MM = 130;

/**
 * Resolve logo image bytes from local disk, data URI, or remote HTTP URL.
 */
async function resolveLogoBytes(logoUrl: string): Promise<Buffer | null> {
  const trimmed = logoUrl.trim();

  // 1. Base64 Data URL
  if (trimmed.startsWith('data:image/')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx !== -1) {
      try {
        return Buffer.from(trimmed.slice(commaIdx + 1), 'base64');
      } catch (err) {
        console.warn('[LOGO RASTER] Failed to decode base64 data URI:', err);
      }
    }
  }

  // 2. Local disk search helper
  const tryReadFromDisk = async (urlPath: string): Promise<Buffer | null> => {
    try {
      const cleanPath = urlPath.replace(/^\/+/, '').replace(/^uploads[\\/]/, 'uploads/');
      const cwd = process.cwd();
      const candidateDirs = [
        path.resolve(cwd, 'public'),
        path.resolve(cwd, 'apps', 'web', 'public'),
        path.resolve(cwd, '..', 'apps', 'web', 'public'),
        path.resolve(cwd, '..', 'web', 'public'),
        path.resolve(cwd, '..', '..', 'apps', 'web', 'public'),
        path.resolve(cwd, '..', 'desktop', 'bundle', 'web-server', 'public'),
        path.resolve(cwd, 'apps', 'desktop', 'bundle', 'web-server', 'public'),
        path.resolve(cwd, '..', '..', 'apps', 'desktop', 'bundle', 'web-server', 'public'),
        path.resolve(cwd, 'Owner-chayaone', 'public'),
        path.resolve(cwd, '..', 'Owner-chayaone', 'public'),
        path.resolve(cwd, '..', '..', 'Owner-chayaone', 'public'),
        path.resolve(cwd, '..', '..', '..', 'Owner-chayaone', 'public'),
      ];

      for (const baseDir of candidateDirs) {
        const fullPath = path.join(baseDir, cleanPath);
        if (fs.existsSync(fullPath)) {
          return await fs.promises.readFile(fullPath);
        }
      }
    } catch (diskErr) {
      console.warn('[LOGO RASTER] Disk read error:', diskErr);
    }
    return null;
  };

  // 3. If relative path or local file
  if (trimmed.startsWith('/') || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
    const localBuf = await tryReadFromDisk(trimmed);
    if (localBuf) return localBuf;
  }

  // 4. If HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(trimmed, { signal: controller.signal });
      clearTimeout(tid);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }
    } catch (fetchErr) {
      console.warn('[LOGO RASTER] HTTP fetch failed, attempting local disk fallback:', fetchErr);
    }

    // Fallback: extract pathname if localhost or relative path was given with host
    try {
      const parsed = new URL(trimmed);
      const diskBuf = await tryReadFromDisk(parsed.pathname);
      if (diskBuf) return diskBuf;
    } catch {}
  }

  return null;
}

/**
 * Download or read a logo image and return an ESC/POS raster buffer (GS v 0).
 * Returns null if the URL is empty, the file cannot be loaded, or Jimp cannot
 * decode the image — the caller should silently fall back to text mode.
 *
 * @param logoUrl  URL or local path of the logo image
 * @param paperWidth  '80mm' or '58mm' — determines centering target width
 */
export async function buildLogoEscposBuffer(
  logoUrl: string | null | undefined,
  paperWidth: '80mm' | '58mm' = '80mm',
): Promise<Buffer | null> {
  if (!logoUrl || typeof logoUrl !== 'string' || !logoUrl.trim()) return null;

  try {
    // 1. Fetch image bytes from local disk, data URI, or network
    const imageBuffer = await resolveLogoBytes(logoUrl);
    if (!imageBuffer || imageBuffer.length === 0) {
      console.warn('[LOGO RASTER] Unable to resolve logo bytes for:', logoUrl);
      return null;
    }

    // 2. Decode image with Jimp v1 API
    const img = await Jimp.fromBuffer(imageBuffer);

    const maxW = paperWidth === '58mm' ? LOGO_MAX_WIDTH_58MM : LOGO_MAX_WIDTH_80MM;
    const maxH = paperWidth === '58mm' ? LOGO_MAX_HEIGHT_58MM : LOGO_MAX_HEIGHT_80MM;
    const targetPrinterWidthDots = paperWidth === '58mm' ? 384 : 576;

    // Preserve exact aspect ratio without letterboxing
    const aspect = img.bitmap.width / img.bitmap.height;
    let newW = maxW;
    let newH = Math.round(maxW / aspect);
    if (newH > maxH) {
      newH = maxH;
      newW = Math.round(maxH * aspect);
    }

    img.resize({ w: newW, h: newH });
    img.greyscale();
    img.contrast(0.35);

    const imgW: number = img.bitmap.width;
    const imgH: number = img.bitmap.height;

    // 3. Build ESC/POS GS v 0 raster rows
    // Manual centering: pad left with white pixels
    const leftPadDots = Math.max(0, Math.floor((targetPrinterWidthDots - imgW) / 2));
    const totalWidthDots = leftPadDots + imgW;
    const bytesPerRow = Math.ceil(totalWidthDots / 8);
    const rasterData = Buffer.alloc(bytesPerRow * imgH, 0x00);

    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        // Jimp v1: getPixelColor returns a packed RGBA integer (RRGGBBAA big-endian)
        const pixelColor: number = img.getPixelColor(x, y);
        const r = (pixelColor >>> 24) & 0xff;
        const g = (pixelColor >>> 16) & 0xff;
        const b = (pixelColor >>> 8) & 0xff;
        const a = pixelColor & 0xff;

        // Transparent pixels (a < 128) must stay white (do not print black dots)
        if (a < 128) {
          continue;
        }

        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (brightness < 128) {
          // Black pixel → set the corresponding bit
          const dotX = leftPadDots + x;
          const byteIdx = y * bytesPerRow + Math.floor(dotX / 8);
          const bitPos = 7 - (dotX % 8);
          const cur = rasterData[byteIdx] ?? 0;
          rasterData[byteIdx] = cur | (1 << bitPos);
        }
      }
    }

    // 4. Build GS v 0 header: m=0 (normal density 203dpi)
    //    xL xH = bytes per raster row (little-endian word)
    //    yL yH = number of rows (little-endian word)
    const xL = bytesPerRow % 256;
    const xH = Math.floor(bytesPerRow / 256);
    const yL = imgH % 256;
    const yH = Math.floor(imgH / 256);
    const gsv0Header = Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);

    // 5. Combine: ALIGN_LEFT + GS v 0 header + raster data + line feeds
    const ALIGN_LEFT = Buffer.from([0x1b, 0x61, 0x00]);
    const lineFeed = Buffer.from([0x0a]);
    const result = Buffer.concat([
      ALIGN_LEFT,
      gsv0Header,
      rasterData,
      lineFeed,
    ]);

    console.log(
      `[LOGO RASTER] Logo encoded: ${imgW}×${imgH} dots, ${bytesPerRow} bytes/row → ${result.length} total bytes (centered at dot ${leftPadDots})`,
    );
    return result;
  } catch (err) {
    console.warn('[LOGO RASTER] Logo raster conversion failed — skipping logo:', err);
    return null;
  }
}
