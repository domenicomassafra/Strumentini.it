import { mutatePdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, resultArtifacts } from "../pdf/shared";
import type { PdfFlattenOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfFlattenOutput> {
    const parsed = mutationInput(value);
    const artifacts = await mutatePdf(parsed.file.blob, { kind: "flatten", filename: parsed.options.filename }, signal);
    return { ...resultArtifacts(artifacts), policy: "Supported page annotation and form hooks are removed; visual appearance is not re-rendered." };
  },
};

export default module;
