import { chooseSupportedRecorderMimeType } from "../../engines/browser-audio";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(input, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("INVALID_INPUT");
    const value = input as Record<string, unknown>;
    if (!Array.isArray(value.supportedMimeTypes) || value.supportedMimeTypes.some((item) => typeof item !== "string")) {
      throw new Error("INVALID_SUPPORTED_MIME_TYPES");
    }
    const supported = new Set(value.supportedMimeTypes as string[]);
    return {
      preferredMimeType: chooseSupportedRecorderMimeType((mimeType) => supported.has(mimeType)),
      maxDurationMs: 15 * 60 * 1000,
      maxBufferedBytes: 256 * 1024 * 1024,
    };
  },
};

export default module;
