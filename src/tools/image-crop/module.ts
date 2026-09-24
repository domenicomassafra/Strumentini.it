import type { ToolModule } from "../../runtime/types";
import { cropImageLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return cropImageLocal(input, signal); } };

export default module;
