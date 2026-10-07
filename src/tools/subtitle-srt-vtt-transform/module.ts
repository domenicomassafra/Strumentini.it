import { processSubtitles, type SubtitleFormat, type SubtitleNegativeOffsetPolicy, type SubtitleOutputKind } from "../../engines/text-writing";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(input, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof input !== "object" || input === null) throw new Error("INVALID_SUBTITLE_INPUT_REQUIRED");
    const record = input as Record<string, unknown>;
    if (typeof record.text !== "string") throw new Error("INVALID_SUBTITLE_INPUT_REQUIRED");
    return processSubtitles({
      text: record.text,
      ...(record.sourceFormat === undefined ? {} : { sourceFormat: record.sourceFormat as SubtitleFormat | "auto" }),
      ...(record.output === undefined ? {} : { output: record.output as SubtitleOutputKind }),
      ...(record.offsetMs === undefined ? {} : { offsetMs: Number(record.offsetMs) }),
      ...(record.scale === undefined ? {} : { scale: Number(record.scale) }),
      ...(record.negativeOffsetPolicy === undefined ? {} : { negativeOffsetPolicy: record.negativeOffsetPolicy as SubtitleNegativeOffsetPolicy }),
      ...(record.readingSpeedCps === undefined ? {} : { readingSpeedCps: Number(record.readingSpeedCps) }),
    });
  },
};

export default module;
