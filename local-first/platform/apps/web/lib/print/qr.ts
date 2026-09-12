/**
 * Cafe OS — Pure Offline QR Code Generator & Thermal Raster Engine.
 *
 * Provides offline QR generation:
 * 1. Data URLs & SVG for browser preview (zero external network requests).
 * 2. ESC/POS native QR command buffers (Model 2, Error Correction Level M).
 * 3. ESC/POS raster bit-image (GS v 0) universal fallback for all thermal printers.
 */

import QRCode from 'qrcode';

export interface QrCodeOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  scale?: number;
  width?: number;
}

/**
 * Generate a base64 PNG Data URL completely offline.
 */
export async function generateQrDataUrl(text: string, options?: QrCodeOptions): Promise<string> {
  if (!text) return '';
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
    margin: options?.margin ?? 2,
    scale: options?.scale ?? 4,
    width: options?.width ?? 200,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Generate an offline SVG string representation.
 */
export async function generateQrSvg(text: string, options?: QrCodeOptions): Promise<string> {
  if (!text) return '';
  return await QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
    margin: options?.margin ?? 2,
    width: options?.width ?? 200,
  });
}

/**
 * Extract 2D boolean module matrix.
 */
export function getQrMatrix(text: string, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'): { size: number; modules: boolean[][] } {
  const qr = QRCode.create(text, { errorCorrectionLevel });
  const size = qr.modules.size;
  const modules: boolean[][] = [];

  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(Boolean(qr.modules.get(r, c)));
    }
    modules.push(row);
  }

  return { size, modules };
}

/**
 * Build standard ESC/POS native QR Code command buffer (Model 2).
 * Supported natively by Epson, Star, Citizen, and modern thermal receipt printers.
 */
export function buildNativeEscposQr(text: string, moduleSize = 5): Buffer {
  const GS = 0x1d;
  const dataBytes = Buffer.from(text, 'utf-8');
  const len = dataBytes.length + 3;
  const pL = len % 256;
  const pH = Math.floor(len / 256);

  const chunks: Buffer[] = [
    // 1. Model 2: GS ( k 4 0 49 65 50 0
    Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    // 2. Module Size: GS ( k 3 0 49 67 <size> (1-16 dots)
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.max(1, Math.min(16, moduleSize))]),
    // 3. Error Correction Level M (~15% recovery): GS ( k 3 0 49 69 49
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
    // 4. Store Data: GS ( k pL pH 49 80 48 <data>
    Buffer.from([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    dataBytes,
    // 5. Print Symbol: GS ( k 3 0 49 81 48
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
  ];

  return Buffer.concat(chunks);
}

/**
 * Build universal ESC/POS raster bit-image buffer (GS v 0).
 * Works reliably across ALL thermal printers (including budget/OEM printers that lack native QR commands).
 * 
 * @param text The text/URI to encode
 * @param scale Number of physical printer dots per QR module (typically 3 to 6)
 * @param quietMargin Quiet zone in modules around the QR (default 3)
 */
export function buildRasterEscposQr(text: string, scale = 4, quietMargin = 3): Buffer {
  const { size: qrSize, modules } = getQrMatrix(text, 'M');

  const totalModules = qrSize + quietMargin * 2;
  const pixelWidth = totalModules * scale;
  const pixelHeight = pixelWidth;

  // Each byte in GS v 0 holds 8 horizontal pixels (1 = black dot, 0 = white paper)
  const bytesPerRow = Math.ceil(pixelWidth / 8);
  const rasterData = Buffer.alloc(bytesPerRow * pixelHeight, 0x00);

  for (let r = 0; r < qrSize; r++) {
    const row = modules[r];
    if (!row) continue;
    for (let c = 0; c < qrSize; c++) {
      if (row[c]) {
        // Module is black — fill scale x scale pixels
        const startX = (c + quietMargin) * scale;
        const startY = (r + quietMargin) * scale;

        for (let dy = 0; dy < scale; dy++) {
          const y = startY + dy;
          const rowOffset = y * bytesPerRow;

          for (let dx = 0; dx < scale; dx++) {
            const x = startX + dx;
            const byteIdx = rowOffset + Math.floor(x / 8);
            const bitPosition = 7 - (x % 8);
            const currentByte = rasterData[byteIdx] ?? 0;
            rasterData[byteIdx] = currentByte | (1 << bitPosition);
          }
        }
      }
    }
  }

  // GS v 0 m xL xH yL yH d1...dk
  // m = 0 (normal density 203 DPI)
  const xL = bytesPerRow % 256;
  const xH = Math.floor(bytesPerRow / 256);
  const yL = pixelHeight % 256;
  const yH = Math.floor(pixelHeight / 256);

  const header = Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  return Buffer.concat([header, rasterData]);
}
