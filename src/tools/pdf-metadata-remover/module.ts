import { removePdfMetadataVerified } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, resultArtifacts } from "../pdf/shared";
import type { PdfMetadataRemoverOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfMetadataRemoverOutput> {
    const parsed = mutationInput(value);
    const verified = await removePdfMetadataVerified(parsed.file.blob, parsed.options.filename, signal);
    const artifacts = [verified.artifact];
    return {
      ...resultArtifacts(artifacts),
      before: verified.before,
      after: verified.after,
      verification: verified.verification,
      policy: "Info dictionary entries and XMP /Metadata streams addressed by this bounded engine are removed. The produced PDF is reparsed; page count and bounded extracted text must remain stable when text extraction is supported.",
    };
  },
};

export default module;
