import type { ToolModule } from "../../runtime/types";
import { calculateAspectRatioLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return calculateAspectRatioLocal(input, signal); } };

export default module;
