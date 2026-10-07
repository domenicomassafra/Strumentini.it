import { extractPdfTextScoped, type PdfTextExtractionMode } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { parsePageList, requireFile } from "../pdf/shared";
import type { PdfTextExtractionOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfTextExtractionOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const input = value as { file?: unknown; pages?: unknown; mode?: unknown };
    const file = requireFile(input.file);
    const pages = input.pages === undefined || input.pages === "" ? undefined : parsePageList(input.pages);
    const mode = input.mode === undefined ? "content-order" : input.mode;
    if (mode !== "content-order" && mode !== "operator-lines") throw new Error("INVALID_INPUT: Choose a supported text extraction mode.");
    return await extractPdfTextScoped(file.blob, { ...(pages === undefined ? {} : { pages }), mode: mode as PdfTextExtractionMode }, signal);
  },
};

export default module;
