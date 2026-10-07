import type { ToolModule } from "../../runtime/types";
import { simulateColorVisionLocal } from "../../engines/image/visual-tools";

const module: ToolModule = {
  run(input, _context, signal) {
    return simulateColorVisionLocal(input, signal);
  },
};

export default module;
