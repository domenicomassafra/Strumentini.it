import type { ToolModule } from "../../runtime/types";
import { convertColorLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return convertColorLocal(input, signal); } };

export default module;
