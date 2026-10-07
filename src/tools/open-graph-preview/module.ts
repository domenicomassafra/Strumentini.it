import { parseOpenGraph, type PreviewPresetId } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value === "string") return parseOpenGraph(value);
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const record = value as Record<string, unknown>;
    const preset = record.preset;
    if (preset !== undefined && preset !== "social-card") throw new Error("INVALID_PREVIEW_PRESET");
    const options = preset === undefined ? {} : { preset: preset as PreviewPresetId };
    if (typeof record.html === "string") return parseOpenGraph(record.html, options);
    if (record.tags !== undefined || record.metadata !== undefined) return parseOpenGraph((record.tags ?? record.metadata) as Readonly<Record<string, unknown>>, options);
    throw new Error("INVALID_INPUT");
  },
};

export default module;
