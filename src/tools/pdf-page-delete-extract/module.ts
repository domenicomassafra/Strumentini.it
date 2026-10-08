import { inspectPdfBytes, mutatePdf, PDF_LIMITS } from "../../engines/pdf";
import { parsePdfPageSelection, strictPdfPageNumbers } from "../../engines/pdf/page-selection";
import type { ToolModule } from "../../runtime/types";
import { requireFile, resultArtifacts } from "../pdf/shared";
import type { PdfPageDeleteExtractOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfPageDeleteExtractOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Seleziona un PDF locale");
    const data = value as { file?: unknown; pages?: unknown; mode?: unknown };
    const file = requireFile(data.file);
    if (file.blob.size > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: File troppo grande");
    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
    const inspected = inspectPdfBytes(new Uint8Array(await file.blob.arrayBuffer()));
    if (inspected.encrypted || inspected.pageCount < 1) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato o senza pagine");
    const mode = data.mode === "delete" ? "delete" : "extract";
    const pages = typeof data.pages === "string"
      ? parsePdfPageSelection(data.pages, inspected.pageCount)
      : strictPdfPageNumbers(data.pages as number[], inspected.pageCount);
    const artifacts = await mutatePdf(file.blob, { kind: mode, filename: file.filename, pages }, signal);
    const expected = mode === "delete" ? inspected.pageCount - pages.length : pages.length;
    if (artifacts.length !== 1 || inspectPdfBytes(artifacts[0]!.bytes).pageCount !== expected) {
      throw new Error("PDF_VERIFICATION_FAILED: Il risultato non contiene il numero di pagine previsto");
    }
    return { ...resultArtifacts(artifacts), mode, pages, sourcePageCount: inspected.pageCount, verifiedOutputPageCount: expected };
  },
};

export default module;
