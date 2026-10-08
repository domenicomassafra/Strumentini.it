import { watermarkPdf, type PdfWatermarkOptions } from "../../engines/pdf/watermark";
import type { ToolModule } from "../../runtime/types";
import { checkSignal, requireFile, resultArtifacts } from "../pdf/shared";

const module: ToolModule = {
  async run(value, _context, signal) {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Carica un PDF");
    const request = value as { file?: unknown; options?: unknown };
    const file = requireFile(request.file);
    if (typeof request.options !== "object" || request.options === null) throw new Error("INVALID_INPUT: Impostazioni watermark mancanti");
    checkSignal(signal);
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    checkSignal(signal);
    const { artifact, plan } = watermarkPdf(bytes, request.options as PdfWatermarkOptions, signal);
    return { ...resultArtifacts([artifact]), plan, safety: "VISIBLE_OVERLAY_NOT_REDACTION",
      policy: "Filigrana visibile, NON redazione dei dati. Contenuti PDF originali byte-invariati: non usare per cancellare informazioni sensibili." };
  },
};
export default module;
