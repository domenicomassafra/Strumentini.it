import { inspectPdfFormAnnotations } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFile } from "../pdf/shared";
import type { PdfFormInspectorOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfFormInspectorOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const file = requireFile((value as { file?: unknown }).file);
    const { inspection, audit } = await inspectPdfFormAnnotations(file.blob, signal);
    return { forms: inspection.forms, pageCount: inspection.pageCount, encrypted: inspection.encrypted, audit };
  },
};

export default module;
