import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const stablePlaceholderAnonymizerManifest = {
  id: "stable-placeholder-anonymizer",
  route: "/tools/stable-placeholder-anonymizer",
  name: "Stable Placeholder Anonymize & Restore",
  summary: "Replace explicitly selected values with stable local placeholders and restore them only with the exact validated mapping.",
  aliases: ["placeholder anonymizer", "anonymize restore text", "stable placeholders"],
  jobs: ["anonymize selected text values", "restore exact placeholder mappings"],
  category: "text",
  inputTypes: ["text", "structured"],
  implementation: "../tools/stable-placeholder-anonymizer/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["stable-placeholder-anonymizer"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-233", fixtureFamilies: ["text-expansion"] },
} as const satisfies ToolManifest;

export default stablePlaceholderAnonymizerManifest;
