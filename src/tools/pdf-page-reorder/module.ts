import { mutatePdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, resultArtifacts } from "../pdf/shared";
import type { PdfPageReorderOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfPageReorderOutput> {
    const parsed = mutationInput(value);
    const artifacts = await mutatePdf(parsed.file.blob, { kind: "reorder", filename: parsed.options.filename, ...(parsed.options.order === undefined ? {} : { order: parsed.options.order }) }, signal);
    return { ...resultArtifacts(artifacts), order: parsed.options.order ?? [] };
  },
};

export default module;
