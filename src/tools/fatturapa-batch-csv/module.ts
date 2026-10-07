import { FATTURAPA_BATCH_MAX_FILES, readFatturaPaBatch } from "../../engines/italy";
import type { ToolModule } from "../../runtime/types";

function nameOf(blob: Blob, index: number): string {
  return "name" in blob && typeof blob.name === "string" && blob.name.trim() !== "" ? blob.name : `fattura-${index + 1}.xml`;
}

const module: ToolModule = {
  async run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof rawInput !== "object" || rawInput === null) throw new Error("INVALID_INPUT");
    const input = rawInput as Record<string, unknown>;
    if (!Array.isArray(input.files) || input.files.length === 0 || input.files.some((file) => !(file instanceof Blob))) throw new Error("INVALID_BATCH_FILES");
    if (input.files.length > FATTURAPA_BATCH_MAX_FILES) throw new Error("TOO_MANY_BATCH_FILES");
    const blobs = input.files as Blob[];
    const files = [];
    for (let index = 0; index < blobs.length; index += 1) {
      if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
      const blob = blobs[index]!;
      files.push({ filename: nameOf(blob, index), bytes: blob.size, text: await blob.text() });
    }
    return readFatturaPaBatch(files);
  },
};

export default module;
