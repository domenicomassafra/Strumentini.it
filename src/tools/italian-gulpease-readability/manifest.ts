import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const italianGulpeaseReadabilityManifest = {
  id: "italian-gulpease-readability",
  route: "/tools/italian-gulpease-readability",
  name: "Italian Gulpease Readability",
  summary: "Calculate the Gulpease index with visible letter, word and sentence counts plus the hardest sentence contributors.",
  aliases: ["gulpease", "italian readability", "indice gulpease"],
  jobs: ["calculate Italian Gulpease readability", "inspect difficult sentence contributors"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/italian-gulpease-readability/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["italian-gulpease-readability"],
  gold: { maintenanceClass: "R", oracleEntryId: "cand-234", fixtureFamilies: ["text-expansion"] },
} as const satisfies ToolManifest;

export default italianGulpeaseReadabilityManifest;
