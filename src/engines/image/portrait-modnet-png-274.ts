/** #274: PNG RGBA bytes without Blob reads (WebKit offline I/O).
 * Reuses the existing MIT-licensed fflate zlib encoder already locked by #047.
 */
import { zlibSync } from "fflate";

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function chunk(name: string, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(payload.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, payload.length, false);
  for (let i = 0; i < 4; i++) bytes[4 + i] = name.charCodeAt(i);
  bytes.set(payload, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < bytes.length - 4; i++) {
    crc ^= bytes[i]!;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0, false);
  return bytes;
}

/** Exact 8-bit RGBA PNG, source alpha preserved; bounded by #274 pixel limits. */
export function encodePortraitPng274(rgba: Uint8ClampedArray, width: number, height: number): ArrayBuffer {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || width > 1600 || height > 1600 || width * height > 2_000_000 || rgba.length !== width * height * 4) {
    throw new Error("PNG_INPUT_INVALID");
  }
  const stride = width * 4;
  const scanlines = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    // PNG filter 0 keeps RGB and alpha bytes identical.
    scanlines.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width, false);
  header.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [
    SIGNATURE, chunk("IHDR", ihdr),
    chunk("IDAT", zlibSync(scanlines, { level: 6 })),
    chunk("IEND", new Uint8Array()),
  ];
  const size = chunks.reduce((sum, bytes) => sum + bytes.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const bytes of chunks) { result.set(bytes, offset); offset += bytes.length; }
  return result.buffer;
}
