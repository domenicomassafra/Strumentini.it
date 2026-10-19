/*
 * Optional, fully local QR image fallback, loaded only after the strict
 * native decoder fails. This does not request a camera or fetch remote data.
 * The caller enforces its existing 4 MP input bound before importing this.
 */
import { QR_RASTER_MAX_PIXELS, type QrReadResult, type RasterPixels } from "./index";

const MAX_QR_TEXT_BYTES = 8192;
const abortIfRequested = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
};

export async function readQrPixelsWithZxing(pixels: RasterPixels, signal?: AbortSignal): Promise<QrReadResult> {
  abortIfRequested(signal);
  const { width, height, data } = pixels;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 21 || height < 21)
    throw new Error("QR_IMAGE_TOO_SMALL");
  if (width * height > QR_RASTER_MAX_PIXELS) throw new Error("QR_IMAGE_TOO_LARGE");
  if (!(data instanceof Uint8ClampedArray) || data.length < width * height * 4)
    throw new Error("QR_INVALID_INPUT");
  if (typeof document === "undefined" || typeof ImageData === "undefined")
    throw new Error("QR_IMAGE_DECODER_UNAVAILABLE");

  // Both imports are resolved locally by the bundler. No network or media API.
  const [{ BrowserQRCodeReader }, { ResultMetadataType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  abortIfRequested(signal);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("QR_IMAGE_DECODER_UNAVAILABLE");
    context.putImageData(new ImageData(new Uint8ClampedArray(data.subarray(0, width * height * 4)), width, height), 0, 0);
    let result;
    try {
      result = new BrowserQRCodeReader().decodeFromCanvas(canvas);
    } catch {
      throw new Error("QR_DECODE_FAILED");
    }
    abortIfRequested(signal);
    const level = String(result.getResultMetadata()?.get(ResultMetadataType.ERROR_CORRECTION_LEVEL) ?? "");
    // Preserve the native decoder's fail-closed behavior for damaged L-level
    // symbols: ZXing may silently correct their altered codewords.
    if (level !== "M" && level !== "Q" && level !== "H") throw new Error("QR_DECODE_FAILED");
    const payload = result.getText();
    const byteLength = new TextEncoder().encode(payload).length;
    if (byteLength === 0 || byteLength > MAX_QR_TEXT_BYTES) throw new Error("QR_DECODE_FAILED");
    return {
      payload,
      source: "image",
      version: 0,
      size: 0,
      mask: null,
      mode: "other",
      errorCorrection: level,
      byteLength,
      maskFromFormatInformation: false,
      formatCopiesAgree: false,
      formatRepairDistance: null,
      errorCorrectionVerified: false,
      engineVersion: "zxing-browser-0.2.1",
    };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
