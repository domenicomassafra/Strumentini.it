import type { ToolModule } from "../../runtime/types";
import { cropImageLocal } from "../../engines/image/visual-tools";
import { transformImageLocal } from "../../engines/image/transform-workspace";
import { straightenPerspectiveLocal } from "../../engines/image/advanced-workspace";
import { renderImageSelectionLocal382 } from "../../engines/image/selection-mask-382";

const module: ToolModule = {
  run(input, _context, signal) {
    if (typeof input === "object" && input !== null && "selection" in input) return renderImageSelectionLocal382(input, signal);
    if (typeof input === "object" && input !== null && "perspective" in input) {
      const record = input as Record<string, unknown>;
      return straightenPerspectiveLocal({ file: record.file, corners: record.perspective }, signal);
    }
    if (typeof input === "object" && input !== null && "transform" in input) return transformImageLocal(input, signal);
    return cropImageLocal(input, signal);
  },
};

export default module;
