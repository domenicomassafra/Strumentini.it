import { mutatePdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, resultArtifacts } from "../pdf/shared";
import type { PdfMetadataRemoverOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfMetadataRemoverOutput> {
    const parsed = mutationInput(value);
    const artifacts = await mutatePdf(parsed.file.blob, { kind: "metadata-remove", filename: parsed.options.filename }, signal);
    return { ...resultArtifacts(artifacts), policy: "Info dictionary and embedded metadata streams addressed by this bounded engine are omitted; this is not a blanket guarantee for every PDF carrier." };
  },
};

export default module;
