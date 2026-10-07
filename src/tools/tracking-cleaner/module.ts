import {
  CAMPAIGN_URL_ENGINE_VERSION,
  cleanTrackingParameters,
  cleanTrackingParametersBulk,
  UTM_DUPLICATE_POLICY,
  UTM_ENCODING_POLICY,
} from "../../engines/campaign-url";
import type { ToolModule } from "../../runtime/types";
import type { TrackingCleanerInput, TrackingCleanerOutput } from "./types";

const module: ToolModule = {
  run(value): TrackingCleanerOutput {
    if (typeof value !== "object" || value === null || typeof (value as Partial<TrackingCleanerInput>).url !== "string") {
      throw new Error("INVALID_INPUT");
    }
    const record = value as TrackingCleanerInput & { bulk?: unknown };
    if (record.bulk !== undefined && typeof record.bulk !== "boolean") throw new Error("INVALID_INPUT");
    if (record.bulk === true) {
      const urls = record.url.replace(/\r\n?/gu, "\n").split("\n").map((entry) => entry.trim()).filter((entry) => entry !== "");
      return cleanTrackingParametersBulk(urls) as unknown as TrackingCleanerOutput;
    }
    return {
      ...cleanTrackingParameters(record.url),
      encodingPolicy: UTM_ENCODING_POLICY,
      duplicatePolicy: UTM_DUPLICATE_POLICY,
      engineVersion: CAMPAIGN_URL_ENGINE_VERSION,
    };
  },
};

export default module;
