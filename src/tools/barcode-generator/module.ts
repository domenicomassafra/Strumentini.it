import { encodeCode128B, encodeEan13, type Ean13Mode } from "../../engines/barcode";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("BARCODE_INPUT_REQUIRED");
    const record = value as { format?: unknown; value?: unknown; mode?: unknown; humanReadable?: unknown };
    const format = record.format;
    if (format !== "ean13" && format !== "code128b") throw new Error("BARCODE_FORMAT_UNSUPPORTED");
    if (typeof record.value !== "string") throw new Error("BARCODE_INPUT_REQUIRED");
    if (record.humanReadable !== undefined && typeof record.humanReadable !== "boolean") throw new Error("BARCODE_HUMAN_READABLE_INVALID");
    const humanReadable = record.humanReadable !== false;
    if (format === "ean13") {
      const mode = record.mode ?? "generate";
      if (mode !== "generate" && mode !== "validate") throw new Error("EAN13_MODE_UNSUPPORTED");
      return encodeEan13(record.value, mode as Ean13Mode, humanReadable);
    }
    if (record.mode !== undefined && record.mode !== "generate") throw new Error("CODE128B_VALIDATE_UNSUPPORTED");
    return encodeCode128B(record.value, humanReadable);
  },
};

export default module;
