import { buildUtmUrl, CAMPAIGN_URL_ENGINE_VERSION } from "../../engines/campaign-url";
import type { ToolModule } from "../../runtime/types";
import type { UtmBuilderInput, UtmBuilderOutput } from "./types";

function validate(value: unknown): UtmBuilderInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Partial<UtmBuilderInput>;
  if ([input.baseUrl, input.source, input.medium, input.campaign].some((item) => typeof item !== "string")) throw new Error("INVALID_INPUT");
  return input as UtmBuilderInput;
}

const module: ToolModule = {
  run(value): UtmBuilderOutput {
    const input = validate(value);
    return { url: buildUtmUrl(input.baseUrl, input), engineVersion: CAMPAIGN_URL_ENGINE_VERSION };
  },
};

export default module;
