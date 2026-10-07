import { validateAudioGeneratorSettings, type AudioGeneratorSettings } from "../../engines/browser-audio";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(input, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("INVALID_INPUT");
    return validateAudioGeneratorSettings(input as AudioGeneratorSettings);
  },
};

export default module;
