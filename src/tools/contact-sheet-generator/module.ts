import type { ToolModule } from "../../runtime/types";
import { createContactSheetLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return createContactSheetLocal(input, signal); } };

export default module;
