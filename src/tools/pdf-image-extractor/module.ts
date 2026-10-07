import { extractPdfImagesScoped } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { parsePageList, requireFile, resultArtifacts } from "../pdf/shared";
import type { PdfImageExtractorOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfImageExtractorOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const input = value as { file?: unknown; pages?: unknown; dedupe?: unknown };
    const file = requireFile(input.file);
    const pages = input.pages === undefined || input.pages === "" ? undefined : parsePageList(input.pages);
    const extracted = await extractPdfImagesScoped(file.blob, { ...(pages === undefined ? {} : { pages }), dedupe: input.dedupe === true }, signal);
    return { ...extracted, ...resultArtifacts(extracted.artifacts) };
  },
};

export default module;
