import type { ToolModule } from "../../runtime/types";
import { inspectMp4Local } from "../../engines/video/mp4-inspection";
import { planVideoTargetSize, type VideoTargetSizeInput } from "../../engines/video/target-size";

type InspectorRuntimeInput =
  | { readonly operation: "inspect"; readonly file: Blob }
  | ({ readonly operation: "target-size" } & VideoTargetSizeInput);

const module: ToolModule = {
  run(input: unknown, _context, signal) {
    if (input instanceof Blob) return inspectMp4Local(input, signal);
    if (input !== null && typeof input === "object" && "operation" in input) {
      const request = input as InspectorRuntimeInput;
      if (request.operation === "inspect" && request.file instanceof Blob) {
        return inspectMp4Local(request.file, signal);
      }
      if (request.operation === "target-size") {
        if (signal?.aborted) throw new DOMException("Video planning cancelled", "AbortError");
        return planVideoTargetSize(request);
      }
    }
    throw new TypeError("INVALID_VIDEO_INPUT: select an MP4 Blob or a target-size request");
  },
};

export default module;
