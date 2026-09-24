import type { ToolModule } from "../../runtime/types";
import { findPerceptualDuplicatesLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return findPerceptualDuplicatesLocal(input, signal); } };

export default module;
