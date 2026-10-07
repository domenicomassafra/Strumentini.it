import type { ToolModule } from "../../runtime/types";
import { createAiCodeFenceBundle } from "../../engines/file-privacy";

const module: ToolModule = { run(input, _context, signal) { return createAiCodeFenceBundle(input, signal); } };
export default module;
