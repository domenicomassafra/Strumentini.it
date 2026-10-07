import type { ToolModule } from "../../runtime/types";
import { createContactSheetLocal } from "../../engines/image/visual-tools";
import { composeImageCollectionLocal, sliceImageLocal } from "../../engines/image/advanced-workspace";

const module: ToolModule = {
  run(input, _context, signal) {
    if (typeof input === "object" && input !== null) {
      const mode = (input as Record<string, unknown>).mode;
      if (mode === "horizontal" || mode === "vertical" || mode === "grid") return composeImageCollectionLocal(input, signal);
      if (mode === "slice") return sliceImageLocal(input, signal);
    }
    return createContactSheetLocal(input, signal);
  },
};

export default module;
