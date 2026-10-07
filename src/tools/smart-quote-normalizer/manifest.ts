import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const smartQuoteNormalizerManifest = {
  id: "smart-quote-normalizer",
  route: "/tools/smart-quote-normalizer",
  name: "Smart-Quote Normalizer",
  summary: "Convert straight quotes to typographic quotes or curly quotes back to straight quotes deterministically.",
  aliases: ["curly quote converter", "straight quote normalizer", "smart punctuation"],
  jobs: ["normalize quotes", "fix curly quotes", "convert quotation marks"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/smart-quote-normalizer/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["smart-quote-normalizer"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-007", fixtureFamilies: ["unicode-normalization", "text-writing-local-jobs"] },
} as const satisfies ToolManifest;

export default smartQuoteNormalizerManifest;
