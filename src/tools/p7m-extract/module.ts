import { extractP7m176, P7M_LIMITS_176 } from "../../engines/p7m/reader-176";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  async run(rawInput, _context, signal) {
    if (typeof rawInput !== "object" || rawInput === null) throw new Error("P7M_INPUT");
    const file = (rawInput as { file?: unknown }).file;
    if (typeof Blob === "undefined" || !(file instanceof Blob)) throw new Error("P7M_INPUT");
    if (file.size === 0 || file.size > P7M_LIMITS_176.maxFileBytes) throw new Error("P7M_LIMIT");
    const named = file as Blob & { name?: unknown };
    const fileName = typeof named.name === "string" && named.name !== "" ? named.name : "documento.p7m";
    return extractP7m176({ bytes: new Uint8Array(await file.arrayBuffer()), fileName }, signal);
  },
};

export default module;
