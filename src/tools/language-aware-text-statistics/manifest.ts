import type { ToolManifest } from "../../catalog/manifest";

export const languageAwareTextStatisticsManifest = {
  id: "language-aware-text-statistics",
  route: "/tools/language-aware-text-statistics",
  name: "Language-Aware Text Statistics",
  summary: "Report word, sentence, character, and Unicode-script statistics with a clearly labeled heuristic language signal.",
  aliases: ["text language statistics", "script counter", "language detector statistics"],
  jobs: ["analyze text language", "count unicode scripts", "profile writing statistics"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/language-aware-text-statistics/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-020", fixtureFamilies: ["unicode-normalization"] },
} as const satisfies ToolManifest;

export default languageAwareTextStatisticsManifest;
