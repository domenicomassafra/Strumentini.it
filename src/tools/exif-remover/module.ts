import type { ToolModule } from "../../runtime/types";
import { stripImageMetadataLocal } from "../../engines/image/strip-metadata";

const module: ToolModule = { run(input, _context, signal) { return stripImageMetadataLocal(input, signal); } };

export default module;
