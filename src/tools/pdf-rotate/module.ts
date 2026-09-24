import { mutatePdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, resultArtifacts } from "../pdf/shared";
import type { PdfRotateOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfRotateOutput> {
    const parsed = mutationInput(value);
    const rotations = parsed.options.rotations ?? { 1: 90 };
    const artifacts = await mutatePdf(parsed.file.blob, { kind: "rotate", filename: parsed.options.filename, rotations }, signal);
    return { ...resultArtifacts(artifacts), rotations };
  },
};

export default module;
