import { mergePdfs } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFiles, resultArtifacts } from "../pdf/shared";
import type { PdfMergeOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfMergeOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose PDF files to merge.");
    const files = requireFiles((value as { files?: unknown }).files, "PDF files");
    const artifact = await mergePdfs(files.map(({ blob }) => blob), signal);
    return { ...resultArtifacts([artifact]), pageCount: artifact.pageCount ?? 0 };
  },
};

export default module;
