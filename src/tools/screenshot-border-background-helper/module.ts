import type { ToolModule } from "../../runtime/types";
import { addImageBorderLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return addImageBorderLocal(input, signal); } };

export default module;
