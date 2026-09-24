import type { ToolManifest } from "../../catalog/manifest";

export const socialCharacterLimitManifest = {
  id: "social-character-limit",
  route: "/tools/social-character-limit",
  name: "Social Character-Limit Checker",
  summary: "Count Unicode code points against a declared social-platform limit with remaining and overflow values.",
  aliases: ["social post length checker", "twitter character counter"],
  jobs: ["check a post length", "compare text against a social limit"],
  category: "marketing",
  inputTypes: ["text"],
  implementation: "../tools/social-character-limit/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "D", oracleEntryId: "cand-069", fixtureFamilies: ["word-character-line-count"] },
} as const satisfies ToolManifest;

export default socialCharacterLimitManifest;
