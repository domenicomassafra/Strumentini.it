import type { ToolModule } from "../../runtime/types";
import { inspectImageBatchLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return inspectImageBatchLocal(input, signal); } };

export default module;
