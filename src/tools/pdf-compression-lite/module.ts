import { mutatePdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, resultArtifacts } from "../pdf/shared";
import type { PdfCompressionOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfCompressionOutput> {
    const parsed = mutationInput(value);
    const artifacts = await mutatePdf(parsed.file.blob, { kind: "compress", filename: parsed.options.filename }, signal);
    return { ...resultArtifacts(artifacts), policy: "This bounded mode normalizes uncompressed stream whitespace and omits addressable metadata; it does not claim lossless image recompression." };
  },
};

export default module;
