import type { ToolModule } from "../../runtime/types";
import { createBooklet251, createInterleave251 } from "../../engines/pdf/booklet-interleave-251";
import { requireFile, resultArtifacts } from "../pdf/shared";

const module: ToolModule = {
  async run(input, _context, signal) {
    if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT: PDF richiesto");
    const value = input as Record<string, unknown>;
    const file = requireFile(value.file);
    if (typeof value.options !== "object" || value.options === null) throw new Error("INVALID_INPUT: Opzioni richieste");
    const source = new File([file.blob], file.filename, { type: "application/pdf" });
    const result = value.mode === "booklet"
      ? await createBooklet251(source, value.options as Parameters<typeof createBooklet251>[1], signal)
      : value.mode === "interleave"
        ? await createInterleave251(source, new File([requireFile(value.backFile).blob], "retro.pdf", { type: "application/pdf" }),
          value.options as Parameters<typeof createInterleave251>[2], signal)
        : (() => { throw new Error("INVALID_INPUT: Modalità non valida"); })();
    return { ...resultArtifacts([result.artifact]), plan: result.plan, fidelity: result.plan.fidelity };
  },
};
export default module;
