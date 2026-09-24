import { generateQr } from "../../engines/qr";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null || typeof (value as { payload?: unknown }).payload !== "string") throw new Error("INVALID_INPUT");
    const record = value as { payload: string; mask?: unknown };
    if (record.mask !== undefined && (typeof record.mask !== "number" || !Number.isInteger(record.mask) || record.mask < 0 || record.mask > 7)) throw new Error("INVALID_QR_MASK");
    return generateQr(record.payload, record.mask === undefined ? {} : { mask: record.mask });
  },
};

export default module;
