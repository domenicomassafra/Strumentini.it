import { inspectPdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFile } from "../pdf/shared";
import type { PdfPageCountVerifierOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfPageCountVerifierOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const file = requireFile((value as { file?: unknown }).file);
    const inspection = await inspectPdf(file.blob, signal);
    return { pageCount: inspection.pageCount, declaredPageCount: inspection.declaredPageCount, objectCount: inspection.objectCount, encrypted: inspection.encrypted, validSignature: inspection.declaredPageCount === null || inspection.declaredPageCount === inspection.pageCount };
  },
};

export default module;
