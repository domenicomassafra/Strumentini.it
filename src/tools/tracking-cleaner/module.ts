import { CAMPAIGN_URL_ENGINE_VERSION, cleanTrackingParameters } from "../../engines/campaign-url";
import type { ToolModule } from "../../runtime/types";
import type { TrackingCleanerInput, TrackingCleanerOutput } from "./types";

const module: ToolModule = {
  run(value): TrackingCleanerOutput {
    if (typeof value !== "object" || value === null || typeof (value as Partial<TrackingCleanerInput>).url !== "string") {
      throw new Error("INVALID_INPUT");
    }
    return { ...cleanTrackingParameters((value as TrackingCleanerInput).url), engineVersion: CAMPAIGN_URL_ENGINE_VERSION };
  },
};

export default module;
