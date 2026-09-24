import type { ToolModule } from "../../runtime/types";
import { compressImageLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return compressImageLocal(input, signal); } };

export default module;
