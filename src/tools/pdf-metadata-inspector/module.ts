import { inspectPdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFile } from "../pdf/shared";
import type { PdfMetadataInspectorOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfMetadataInspectorOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const file = requireFile((value as { file?: unknown }).file);
    const inspection = await inspectPdf(file.blob, signal);
    return { inspection, pageCount: inspection.pageCount, byteLength: inspection.byteLength, encrypted: inspection.encrypted };
  },
};

export default module;
