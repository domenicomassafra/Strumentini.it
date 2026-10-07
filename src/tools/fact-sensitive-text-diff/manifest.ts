import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const factSensitiveTextDiffManifest = {
  id: "fact-sensitive-text-diff",
  route: "/tools/fact-sensitive-text-diff",
  name: "Fact-Sensitive Lexical Text Diff",
  summary: "Compare two texts and surface changed lexical numbers, dates, URLs and structured IDs ahead of whitespace-only edits.",
  aliases: ["fact sensitive diff", "compare original ai text", "number date url diff"],
  jobs: ["compare an original and rewritten text", "surface changed numbers dates urls and ids"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/fact-sensitive-text-diff/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["fact-sensitive-text-diff"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-232", fixtureFamilies: ["text-expansion"] },
} as const satisfies ToolManifest;

export default factSensitiveTextDiffManifest;
