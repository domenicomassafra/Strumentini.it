import type { ToolModule } from "../../runtime/types";
import { inspectColorLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return inspectColorLocal(input, signal); } };

export default module;
