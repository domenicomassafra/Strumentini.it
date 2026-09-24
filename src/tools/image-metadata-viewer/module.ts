import type { ToolModule } from "../../runtime/types";
import { inspectImageMetadataLocal } from "../../engines/image/visual-tools";

const module: ToolModule = { run(input, _context, signal) { return inspectImageMetadataLocal(input, signal); } };

export default module;
