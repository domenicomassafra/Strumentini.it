import {
  buildUtmUrl,
  buildUtmUrlsBulk,
  CAMPAIGN_URL_ENGINE_VERSION,
  UTM_DUPLICATE_POLICY,
  UTM_ENCODING_POLICY,
} from "../../engines/campaign-url";
import type { ToolModule } from "../../runtime/types";
import type { UtmBuilderInput, UtmBuilderOutput } from "./types";

function validate(value: unknown): UtmBuilderInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Partial<UtmBuilderInput>;
  if ([input.baseUrl, input.source, input.medium, input.campaign].some((item) => typeof item !== "string")) throw new Error("INVALID_INPUT");
  return input as UtmBuilderInput;
}

function lines(value: string): readonly string[] {
  return value.replace(/\r\n?/gu, "\n").split("\n").map((entry) => entry.trim()).filter((entry) => entry !== "");
}

const module: ToolModule = {
  run(value): UtmBuilderOutput | unknown {
    const input = validate(value);
    const bulk = (value as Record<string, unknown>).bulk === true;
    if (bulk) return buildUtmUrlsBulk(lines(input.baseUrl), input);
    return {
      url: buildUtmUrl(input.baseUrl, input),
      encodingPolicy: UTM_ENCODING_POLICY,
      duplicatePolicy: UTM_DUPLICATE_POLICY,
      engineVersion: CAMPAIGN_URL_ENGINE_VERSION,
    };
  },
};

export default module;
