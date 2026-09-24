import type { ToolModule } from "../../runtime/types";
import { compareImagesLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return compareImagesLocal(input, signal); } };

export default module;
