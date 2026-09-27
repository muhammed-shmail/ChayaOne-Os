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

import { Jimp } from 'jimp';

/** Maximum logo width in printer dots (80mm @ 203dpi ≈ 576 dots, 58mm ≈ 384 dots). */
const LOGO_MAX_WIDTH_80MM = 320; // ~40mm — centred on 576-dot wide paper
const LOGO_MAX_WIDTH_58MM = 200; // ~25mm — centred on 384-dot wide paper

/** Maximum logo height in dots (no taller than ~15mm). */
const LOGO_MAX_HEIGHT = 100;

/** ESC/POS ALIGN CENTER command. */
const ALIGN_CENTER = Buffer.from([0x1b, 0x61, 0x01]);

/**
 * Download a logo image and return an ESC/POS raster buffer (GS v 0).
 * Returns null if the URL is empty, the fetch fails, or Jimp cannot
 * decode the image — the caller should silently fall back to text mode.
 *
 * @param logoUrl  Absolute URL of the logo image (Supabase public URL etc.)
 * @param paperWidth  '80mm' or '58mm' — determines centering target width
 */
export async function buildLogoEscposBuffer(
  logoUrl: string | null | undefined,
  paperWidth: '80mm' | '58mm' = '80mm',
): Promise<Buffer | null> {
  if (!logoUrl || typeof logoUrl !== 'string' || !logoUrl.trim()) return null;

  try {
    // 1. Download image bytes (5-second timeout)
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    let imageBuffer: Buffer;
    try {
      const res = await fetch(logoUrl.trim(), { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) {
        console.warn(`[LOGO RASTER] HTTP ${res.status} fetching logo — skipping`);
        return null;
      }
      const ab = await res.arrayBuffer();
      imageBuffer = Buffer.from(ab);
    } catch (fetchErr) {
      clearTimeout(tid);
      console.warn('[LOGO RASTER] Logo fetch failed:', fetchErr);
      return null;
    }

    // 2. Decode, resize, greyscale → 1-bit
    const maxW = paperWidth === '58mm' ? LOGO_MAX_WIDTH_58MM : LOGO_MAX_WIDTH_80MM;
    const targetPrinterWidthDots = paperWidth === '58mm' ? 384 : 576;

    // Load image with Jimp v1 API
    const img = await Jimp.fromBuffer(imageBuffer);

    // Fit inside maxW × LOGO_MAX_HEIGHT preserving aspect ratio
    img.contain({ w: maxW, h: LOGO_MAX_HEIGHT });

    // Greyscale + contrast boost so coloured logos survive 1-bit threshold
    img.greyscale();
    img.contrast(0.35);

    const imgW: number = img.bitmap.width;
    const imgH: number = img.bitmap.height;

    // 3. Build ESC/POS GS v 0 raster rows
    const leftPadDots = Math.max(0, Math.floor((targetPrinterWidthDots - imgW) / 2));
    const totalWidthDots = targetPrinterWidthDots;
    const bytesPerRow = Math.ceil(totalWidthDots / 8);
    const rasterData = Buffer.alloc(bytesPerRow * imgH, 0x00);

    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        // Jimp v1: getPixelColor returns a packed RGBA integer (RRGGBBAA big-endian)
        const pixelColor: number = img.getPixelColor(x, y);
        const r = (pixelColor >>> 24) & 0xff;
        const g = (pixelColor >>> 16) & 0xff;
        const b = (pixelColor >>> 8) & 0xff;
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

    // 5. Combine: ALIGN_CENTER + GS v 0 header + raster data + two line feeds
    const lineFeed = Buffer.from([0x0a]);
    const result = Buffer.concat([
      ALIGN_CENTER,
      gsv0Header,
      rasterData,
      lineFeed,
      lineFeed,
    ]);

    console.log(
      `[LOGO RASTER] Logo encoded: ${imgW}×${imgH} dots, ${bytesPerRow} bytes/row → ${result.length} total bytes`,
    );
    return result;
  } catch (err) {
    console.warn('[LOGO RASTER] Logo raster conversion failed — skipping logo:', err);
    return null;
  }
}
