import { readQr } from "../../engines/qr";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<unknown> {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value === "string") return readQr(value);
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    return readQr(value);
  },
};

export default module;
