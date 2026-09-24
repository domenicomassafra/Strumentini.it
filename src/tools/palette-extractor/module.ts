import type { ToolModule } from "../../runtime/types";
import { extractImagePaletteLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return extractImagePaletteLocal(input, signal); } };

export default module;
