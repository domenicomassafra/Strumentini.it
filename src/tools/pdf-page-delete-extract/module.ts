import { mutatePdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, resultArtifacts } from "../pdf/shared";
import type { PdfPageDeleteExtractOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfPageDeleteExtractOutput> {
    const parsed = mutationInput(value);
    const mode = typeof value === "object" && value !== null && (value as { mode?: unknown }).mode === "delete" ? "delete" : "extract";
    const pages = parsed.options.pages ?? [];
    const artifacts = await mutatePdf(parsed.file.blob, { kind: mode, filename: parsed.options.filename, pages }, signal);
    return { ...resultArtifacts(artifacts), mode, pages };
  },
};

export default module;
