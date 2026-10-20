import { readEpubInWorker422 } from "../../engines/epub/worker-boundary-422";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (typeof rawInput !== "object" || rawInput === null) throw new Error("EPUB_INPUT");
    const file = (rawInput as { file?: unknown }).file;
    if (!(file instanceof File)) throw new Error("EPUB_INPUT");
    return readEpubInWorker422(file, signal);
  },
};
export default module;
