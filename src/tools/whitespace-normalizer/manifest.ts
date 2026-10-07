import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const whitespaceNormalizerManifest = {
  id: "whitespace-normalizer",
  route: "/tools/whitespace-normalizer",
  name: "Whitespace Normalizer",
  summary: "Normalize line endings and Unicode whitespace while preserving the text's meaningful line structure.",
  aliases: ["clean whitespace", "trim spaces", "normalize spaces", "whitespace cleaner"],
  jobs: ["normalize whitespace", "clean copied text", "remove trailing spaces"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/whitespace-normalizer/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["whitespace-normalizer"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-004", fixtureFamilies: ["whitespace-normalization", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default whitespaceNormalizerManifest;
