import type { ToolModule } from "../../runtime/types";
import { createIconSizesLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return createIconSizesLocal(input, signal); } };

export default module;
