import type { ToolModule } from "../../runtime/types";
import { compressImageLocal } from "../../engines/image/visual-tools";
import { compressImageBatchLocal } from "../../engines/image/batch-compression";

const module: ToolModule = {
  run(input, _context, signal) {
    return typeof input === "object" && input !== null && "files" in input
      ? compressImageBatchLocal(input, signal)
      : compressImageLocal(input, signal);
  },
};

export default module;
