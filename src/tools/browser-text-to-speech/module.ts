import { validateSpeechControls } from "../../engines/browser-audio";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(input, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("INVALID_INPUT");
    const value = input as Record<string, unknown>;
    const text = value.text;
    if (typeof text !== "string" || text.trim() === "" || text.length > 20_000) throw new Error("INVALID_SPEECH_TEXT");
    const rate = value.rate;
    const pitch = value.pitch;
    if (typeof rate !== "number" || typeof pitch !== "number") throw new Error("INVALID_SPEECH_CONTROLS");
    return { textLength: text.length, ...validateSpeechControls({ rate, pitch }) };
  },
};

export default module;
