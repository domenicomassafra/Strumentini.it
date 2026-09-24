import { extractPdfImages } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFile, resultArtifacts } from "../pdf/shared";
import type { PdfToImagesOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfToImagesOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const file = requireFile((value as { file?: unknown }).file);
    const artifacts = await extractPdfImages(file.blob, signal);
    return resultArtifacts(artifacts);
  },
};

export default module;
