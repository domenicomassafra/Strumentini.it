import { buildPrintablePdf, type PrintablePdfOptions } from "../../engines/pdf/printable-document";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: documento richiesto");
    const pdf = buildPrintablePdf(value as PrintablePdfOptions);
    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
    return {
      artifacts: [{ bytes: pdf.bytes, blob: pdf.blob, filename: pdf.filename, mime: "application/pdf", pageCount: pdf.pageCount }],
      artifactCount: 1, pageCount: pdf.pageCount, widthPt: pdf.widthPt, heightPt: pdf.heightPt,
      warnings: pdf.warnings, fontPolicy: pdf.fontPolicy,
    };
  },
};

export default module;
