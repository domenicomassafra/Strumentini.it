import { numberPdfPages } from "../../engines/pdf/page-numbers";
import type { PdfPageNumberOptions } from "../../engines/pdf/page-numbers";
import type { ToolModule } from "../../runtime/types";
import { checkSignal, requireFile, resultArtifacts } from "../pdf/shared";

const module: ToolModule = {
  async run(value, _context, signal) {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Carica un file PDF");
    const input = value as { file?: unknown; options?: unknown };
    const file = requireFile(input.file);
    if (typeof input.options !== "object" || input.options === null) throw new Error("INVALID_INPUT: Impostazioni numerazione mancanti");
    checkSignal(signal);
    const source = new Uint8Array(await file.blob.arrayBuffer());
    checkSignal(signal);
    const result = numberPdfPages(source, input.options as PdfPageNumberOptions, signal);
    return { ...resultArtifacts([result.artifact]), plan: result.plan,
      policy: "Overlay PDF locale su stream separati, contenuti originali byte-invariati. Non è certificato per form PDF con annotazioni complesse." };
  },
};

export default module;
