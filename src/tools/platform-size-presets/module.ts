import type { ToolModule } from "../../runtime/types";
import { calculatePlatformSizesLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return calculatePlatformSizesLocal(input, signal); } };

export default module;
