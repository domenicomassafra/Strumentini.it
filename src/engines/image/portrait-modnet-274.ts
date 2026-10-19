/** Experimental portrait-only alpha matting; the model and runtime are served from this origin. */
export const PORTRAIT_MODEL_UPSTREAM = "Xenova/modnet";
export const PORTRAIT_MODEL_REVISION = "fa2fa546052fba4c08921230a26cc69a333fca12";
export const PORTRAIT_MODEL_SHA256 = "92e49898c3e05a6d7a944fc67a8cb87c4aad754ffb6ebd949528c7d1105fee3a";
export const PORTRAIT_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const PORTRAIT_MAX_SIDE = 1600;
export const PORTRAIT_MAX_PIXELS = 2_000_000;
export const PORTRAIT_TIMEOUT_MS = 120_000;

export function checkPortraitInput(bytes: number, width: number, height: number, deviceMemory?: number): void {
  if (!Number.isSafeInteger(bytes) || bytes < 64 || bytes > PORTRAIT_MAX_FILE_BYTES) throw new Error("FILE_SIZE_LIMIT");
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || width > PORTRAIT_MAX_SIDE || height > PORTRAIT_MAX_SIDE || width * height > PORTRAIT_MAX_PIXELS) {
    throw new Error("PIXEL_LIMIT");
  }
  if (deviceMemory !== undefined && deviceMemory > 0 && deviceMemory < 4) throw new Error("MEMORY_LIMIT");
}

export function checkPortraitPng(bytes: Uint8Array, width: number, height: number): void {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.byteLength < 48 || signature.some((byte, index) => bytes[index] !== byte)) throw new Error("PNG_INVALID");
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (header.getUint32(8) !== 13 || header.getUint32(12) !== 0x49484452
    || header.getUint32(16) !== width || header.getUint32(20) !== height || bytes[25] !== 6) {
    throw new Error("PNG_INVALID");
  }
}
