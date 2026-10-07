import { FATTURAPA_FILE_MAX_BYTES, readFatturaPaXml } from "../../engines/italy";
import type { ToolModule } from "../../runtime/types";

function nameOf(blob: Blob, fallback: string): string {
  return "name" in blob && typeof blob.name === "string" && blob.name.trim() !== "" ? blob.name : fallback;
}

const module: ToolModule = {
  async run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof rawInput !== "object" || rawInput === null) throw new Error("INVALID_INPUT");
    const input = rawInput as Record<string, unknown>;
    if (!(input.file instanceof Blob)) throw new Error("INVALID_INPUT");
    if (input.file.size > FATTURAPA_FILE_MAX_BYTES) throw new Error("FILE_TOO_LARGE");
    const text = await input.file.text();
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    return { filename: nameOf(input.file, "fattura.xml"), bytes: input.file.size, ...readFatturaPaXml(text) };
  },
};

export default module;
