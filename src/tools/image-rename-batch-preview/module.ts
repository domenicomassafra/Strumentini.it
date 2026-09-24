import type { ToolModule } from "../../runtime/types";
import { previewImageRenamesLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return previewImageRenamesLocal(input, signal); } };

export default module;
