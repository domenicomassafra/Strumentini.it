import type { ToolModule } from "../../runtime/types";
import { addImageBorderLocal } from "../../engines/image/visual-tools";
import { composeWatermarkLocal, stitchScreenshotsLocal, suggestScreenshotOverlapLocal } from "../../engines/image/advanced-workspace";
import { composeTextShapes384 } from "../../engines/image/text-shapes-384";

const module: ToolModule = {
  run(input, _context, signal) {
    if (typeof input === "object" && input !== null) {
      const mode = (input as Record<string, unknown>).mode;
      if (mode === "watermark") return composeWatermarkLocal(input, signal);
      if (mode === "text-shapes-384") return composeTextShapes384(input, signal);
      if (mode === "stitch-suggest") return suggestScreenshotOverlapLocal(input, signal);
      if (mode === "stitch") return stitchScreenshotsLocal(input, signal);
    }
    return addImageBorderLocal(input, signal);
  },
};

export default module;
