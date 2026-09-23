import { buildCampaignName, CAMPAIGN_URL_ENGINE_VERSION } from "../../engines/campaign-url";
import type { ToolModule } from "../../runtime/types";
import type { CampaignNameInput, CampaignNameOutput } from "./types";

const module: ToolModule = {
  run(value): CampaignNameOutput {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const input = value as Partial<CampaignNameInput>;
    if (typeof input.preset !== "object" || input.preset === null || typeof input.values !== "object" || input.values === null) {
      throw new Error("INVALID_INPUT");
    }
    return { name: buildCampaignName(input.preset as CampaignNameInput["preset"], input.values), engineVersion: CAMPAIGN_URL_ENGINE_VERSION };
  },
};

export default module;
