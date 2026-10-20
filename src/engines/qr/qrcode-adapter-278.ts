/** #278: qrcode@1.5.4 (MIT) for bounded, local QR generation.
 * The public, tested canonical engine remains available as an explicit
 * rollback if the donor cannot encode an otherwise supported byte payload. */
import QRCode, { type QRCodeMaskPattern } from "qrcode";
import { generateQr, QR_QUIET_ZONE, renderQrSvg, type QrGenerateResult } from "./encode";
import { QR_MAX_BYTES, QR_EC_LEVEL, chooseVersion } from "./spec";

export const QR_DONOR278_VERSION = "qrcode@1.5.4-byte-L";

export function generateQrDonor278(payload: string, options: { readonly mask?: number } = {}): QrGenerateResult {
  if (typeof payload !== "string" || payload.length === 0) throw new Error("QR_PAYLOAD_REQUIRED");
  const bytes = new TextEncoder().encode(payload);
  if (bytes.length > QR_MAX_BYTES) throw new Error("QR_PAYLOAD_TOO_LARGE");
  const spec = chooseVersion(bytes.length);
  if (options.mask !== undefined && (!Number.isInteger(options.mask) || options.mask < 0 || options.mask > 7)) {
    throw new Error("QR_INVALID_MASK");
  }
  try {
    // Explicit byte mode prevents donor numeric/alphanumeric auto-segmentation
    // from changing the legacy version, capacity or error-correction envelope.
    const encoded = QRCode.create([{ data: bytes, mode: "byte" }], {
      version: spec.version,
      errorCorrectionLevel: "L",
      ...(options.mask === undefined ? {} : { maskPattern: options.mask as QRCodeMaskPattern }),
    });
    if (encoded.version !== spec.version || encoded.modules.size !== spec.size ||
        encoded.maskPattern === undefined || !Number.isInteger(encoded.maskPattern)) {
      throw new Error("QR_DONOR_INCOMPATIBLE");
    }
    const matrix = Array.from({ length: spec.size }, (_row, y) =>
      Array.from({ length: spec.size }, (_cell, x) => encoded.modules.data[y * spec.size + x] === 1));
    const matrixRows = matrix.map((row) => row.map((isDark) => isDark ? "1" : "0").join(""));
    return {
      payload, byteLength: bytes.length, mode: "byte", version: spec.version, size: spec.size,
      errorCorrection: QR_EC_LEVEL, mask: encoded.maskPattern, quietZone: QR_QUIET_ZONE,
      matrix, matrixRows, svg: renderQrSvg(matrixRows), engineVersion: QR_DONOR278_VERSION,
    };
  } catch {
    // A visible, source-identified local fallback preserves the previously
    // proven errors, matrix contract and SVG when upstream encoding fails.
    return { ...generateQr(payload, options), engineVersion: "qr-local-fallback-from-qrcode@1.5.4" };
  }
}
