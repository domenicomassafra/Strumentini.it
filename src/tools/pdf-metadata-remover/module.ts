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
      policy: "Rimossi campi /Info e stream XMP /Metadata del PDF. Il PDF finale viene riparsato e ogni JPEG DCT incorporato viene ispezionato: se conserva metadati il risultato viene rifiutato. Codec e contenuti non supportati sono elencati come residui non verificati, senza dichiarare il documento completamente anonimo. Pagine e testo estratto rimangono stabili entro i limiti del motore.",
    };
  },
};

export default module;
