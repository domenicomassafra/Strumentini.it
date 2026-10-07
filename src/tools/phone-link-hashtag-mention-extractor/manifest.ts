import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const phoneLinkHashtagMentionExtractorManifest = {
  id: "phone-link-hashtag-mention-extractor",
  route: "/tools/phone-link-hashtag-mention-extractor",
  name: "Phone, Link, Hashtag & Mention Extractor",
  summary: "Extract conservative typed matches with exact source spans, deterministic overlap handling and explicit normalization rules.",
  aliases: ["extract phone links hashtags mentions", "contact extractor", "social token extractor"],
  jobs: ["extract phones links hashtags and mentions", "export typed text matches to CSV"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/phone-link-hashtag-mention-extractor/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["phone-link-hashtag-mention-extractor"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-237", fixtureFamilies: ["text-expansion"] },
} as const satisfies ToolManifest;

export default phoneLinkHashtagMentionExtractorManifest;
