import type { ToolModule } from "../../runtime/types";
import { convertImageFormatLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return convertImageFormatLocal(input, signal); } };

export default module;
