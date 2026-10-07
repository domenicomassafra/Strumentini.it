import { pdfToMarkdown } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { checkSignal, requireFile } from "../pdf/shared";

const module: ToolModule = {
  async run(value, _context, signal): Promise<unknown> {
    checkSignal(signal);
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const file = requireFile((value as { file?: unknown }).file, "PDF file");
    return await pdfToMarkdown(file.filename, file.blob, signal);
  },
};

export default module;
