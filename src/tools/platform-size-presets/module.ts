import type { ToolModule } from "../../runtime/types";
import { calculatePlatformSizesLocal, createPlatformImageExportLocal } from "../../engines/image/visual-tools";

const module: ToolModule = {
  run(input, _context, signal) {
    if (typeof input === "object" && input !== null && "file" in input && (input as Record<string, unknown>).file !== undefined) {
      return createPlatformImageExportLocal(input, signal);
    }
    return calculatePlatformSizesLocal(input, signal);
  },
};

export default module;
