import type { ToolModule } from "../../runtime/types";
import { createPdfNUp, type PdfNUpOptions } from "../../engines/pdf/n-up";
import { checkSignal, requireFile, resultArtifacts } from "../pdf/shared";

const module: ToolModule = {
  async run(input, _context, signal) {
    if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT: PDF e opzioni richiesti");
    const value = input as Record<string, unknown>;
    const original = requireFile(value.file);
    if (typeof value.options !== "object" || value.options === null) throw new Error("INVALID_INPUT: Parametri n-up richiesti");
    checkSignal(signal);
    const source = new File([original.blob], original.filename, { type: "application/pdf" });
    const { artifact, plan } = await createPdfNUp(source, value.options as PdfNUpOptions, signal);
    checkSignal(signal);
    return {
      ...resultArtifacts([artifact]),
      plan,
      fidelity: plan.fidelity,
      policy: "Output raster JPEG: il testo selezionabile, i link, i vettori e i metadati originali vengono persi. Le pagine con annotazioni sono rifiutate.",
    };
  },
};
export default module;
