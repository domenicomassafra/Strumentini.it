import { generateQr, QR_MAX_BYTES, QR_MAX_VERSION } from "../../engines/qr";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null || typeof (value as { payload?: unknown }).payload !== "string") throw new Error("QR_INPUT_REQUIRED");
    const record = value as { payload: string; mask?: unknown };
    if (record.mask !== undefined && (typeof record.mask !== "number" || !Number.isInteger(record.mask) || record.mask < 0 || record.mask > 7)) throw new Error("QR_INVALID_MASK");
    const result = generateQr(record.payload, record.mask === undefined ? {} : { mask: record.mask });
    return {
      ...result,
      byteLimit: QR_MAX_BYTES,
      maxVersion: QR_MAX_VERSION,
      bytesRemaining: QR_MAX_BYTES - result.byteLength,
      dataUrl: `data:image/svg+xml,${encodeURIComponent(result.svg)}`,
    };
  },
};

export default module;