import type { ToolModule } from "../../runtime/types";
import { extractDominantColorLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return extractDominantColorLocal(input, signal); } };

export default module;
