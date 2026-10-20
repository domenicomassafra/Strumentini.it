import { pixelsFor, readQrMatrix, readQrPixels, type RasterPixels } from "../../engines/qr";
import type { ToolModule } from "../../runtime/types";

function pixelsOrInvalid(value: unknown): RasterPixels {
  if (typeof value !== "object" || value === null) throw new Error("QR_INVALID_INPUT");
  const record = value as { width?: unknown; height?: unknown; data?: unknown };
  if (typeof record.width !== "number" || typeof record.height !== "number" || !ArrayBuffer.isView(record.data)) throw new Error("QR_INVALID_INPUT");
  return { width: record.width, height: record.height, data: record.data as Uint8ClampedArray };
}

/**
 * The reader accepts a pasted matrix, JSON array, block of rows or this tool's
 * own SVG, plus raw image pixels. There is no platform barcode API anywhere in
 * the path, so the same read works on every supported browser.
 */
const module: ToolModule = {
  async run(value, _context, signal): Promise<unknown> {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value === "string") return readQrMatrix(value);
    if (typeof value !== "object" || value === null) throw new Error("QR_INVALID_INPUT");
    const record = value as Record<string, unknown>;
    if (record.pixels !== undefined || record.image !== undefined) {
      const pixels = record.pixels !== undefined
        ? pixelsOrInvalid(record.pixels)
        : await pixelsFor(record.image as Parameters<typeof pixelsFor>[0]);
      // The native decoder remains authoritative for its supported symbols.
      // Load ZXing only after the native path returns QR_DECODE_FAILED.
      try {
        return readQrPixels(pixels);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "QR_DECODE_FAILED") throw error;
      }
      if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
      const { readQrPixelsWithZxing } = await import("../../engines/qr/zxing-adapter");
      return readQrPixelsWithZxing(pixels, signal);
    }
    if (record.matrix !== undefined) return readQrMatrix(record.matrix);
    if (typeof record.svg === "string") return readQrMatrix(record.svg);
    if (typeof record.rows === "string") return readQrMatrix(record.rows);
    throw new Error("QR_INPUT_REQUIRED");
  },
};

export default module;
