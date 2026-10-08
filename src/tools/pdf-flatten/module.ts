import { flattenPdfVerified } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, resultArtifacts } from "../pdf/shared";
import type { PdfFlattenOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfFlattenOutput> {
    const parsed = mutationInput(value);
    const { artifact, verification } = await flattenPdfVerified(parsed.file.blob, parsed.options.filename, signal);
    return {
      ...resultArtifacts([artifact]), verification,
      policy: "Solo annotazioni non visibili e campi AcroForm senza aspetto pagina. Annotazioni/widget visibili rifiutati: le appearance non vengono dipinte dal motore locale. Nessuna equivalenza pixel viene dichiarata senza render.",
    };
  },
};

export default module;
