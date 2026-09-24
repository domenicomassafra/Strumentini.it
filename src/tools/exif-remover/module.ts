import type { ToolModule } from "../../runtime/types";
import { reencodeImageLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return reencodeImageLocal(input, signal); } };

export default module;
