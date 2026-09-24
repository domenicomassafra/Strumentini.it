import { inspectPdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFile } from "../pdf/shared";
import type { PdfLinkExtractorOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfLinkExtractorOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const file = requireFile((value as { file?: unknown }).file);
    const inspection = await inspectPdf(file.blob, signal);
    return { links: inspection.links, pageCount: inspection.pageCount };
  },
};

export default module;
