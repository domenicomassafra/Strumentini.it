import { cropNormalizePdf, type PdfCropNormalizeOptions } from "../../engines/pdf/crop-normalize";
import type { ToolModule } from "../../runtime/types";
import { checkSignal, requireFile, resultArtifacts } from "../pdf/shared";

const module: ToolModule = {
  async run(input, _context, signal) {
    if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT: PDF richiesto");
    const value = input as { file?: unknown; options?: unknown };
    const file = requireFile(value.file);
    if (typeof value.options !== "object" || value.options === null) throw new Error("INVALID_INPUT: Parametri crop/normalizzazione richiesti");
    checkSignal(signal);
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    checkSignal(signal);
    const { artifact, plan } = cropNormalizePdf(bytes, value.options as PdfCropNormalizeOptions, signal);
    return { ...resultArtifacts([artifact]), plan, safety: plan.warning,
      policy: "Crop modifica la sola visibilità: NASCONDE e non elimina dati. La normalizzazione centra o scala uniformemente; stream originali conservati." };
  },
};
export default module;
