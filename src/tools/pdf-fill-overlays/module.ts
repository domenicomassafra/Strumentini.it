import type { ToolModule } from "../../runtime/types";
import { requireFile, resultArtifacts } from "../pdf/shared";
import { writePdf243, type Pdf243Options } from "../../engines/pdf/fill-overlays-243";

const module: ToolModule = {
  async run(input, _context, signal) {
    if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT: PDF richiesto");
    const object = input as Record<string, unknown>;
    const file = requireFile(object.file);
    if (typeof object.options !== "object" || object.options === null) throw new Error("INVALID_INPUT: Parametri richiesti");
    const output = writePdf243(new Uint8Array(await file.blob.arrayBuffer()), object.options as Pdf243Options, signal);
    return { ...resultArtifacts([output.artifact]), plan: output.plan, outputPolicy: output.plan.outputPolicy };
  },
};
export default module;
