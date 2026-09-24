import { extractPdfText } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFile } from "../pdf/shared";
import type { PdfTextExtractionOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfTextExtractionOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const file = requireFile((value as { file?: unknown }).file);
    const pages = await extractPdfText(file.blob, signal);
    return { pages, text: pages.map((page) => page.text).join("\n\n"), truncated: pages.some((page) => page.truncated) };
  },
};

export default module;
