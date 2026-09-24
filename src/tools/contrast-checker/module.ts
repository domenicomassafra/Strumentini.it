import type { ToolModule } from "../../runtime/types";
import { checkContrastLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return checkContrastLocal(input, signal); } };

export default module;
