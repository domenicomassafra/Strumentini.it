import { mutatePdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, parsePageGroups, resultArtifacts } from "../pdf/shared";
import type { PdfSplitOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfSplitOutput> {
    const parsed = mutationInput(value);
    const rawGroups = typeof value === "object" && value !== null ? (value as { groups?: unknown }).groups : undefined;
    const groups = rawGroups === undefined ? undefined : parsePageGroups(rawGroups);
    const artifacts = await mutatePdf(parsed.file.blob, { kind: "split", filename: parsed.options.filename, ...(groups === undefined ? {} : { groups }) }, signal);
    return { ...resultArtifacts(artifacts), operation: "split" };
  },
};

export default module;
