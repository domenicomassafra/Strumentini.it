import type { ToolModule } from "../../runtime/types";
import { inspectImageMetadataViewer272Local } from "../../engines/image/metadata-viewer-272";

const module: ToolModule = { run(input, _context, signal) { return inspectImageMetadataViewer272Local(input, signal); } };

export default module;
