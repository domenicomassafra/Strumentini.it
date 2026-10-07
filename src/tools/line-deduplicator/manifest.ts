import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const lineDeduplicatorManifest = {
  id: "line-deduplicator",
  route: "/tools/line-deduplicator",
  name: "Line Deduplicator",
  summary: "Remove duplicate lines with exact, trim, NFC, or trim-plus-NFC equality rules.",
  aliases: ["dedupe lines", "remove duplicate lines", "unique line list"],
  jobs: ["deduplicate a line list", "remove repeated list items", "make a unique list"],
  category: "text",
  inputTypes: ["text", "list"],
  implementation: "../tools/line-deduplicator/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["line-deduplicator"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-009", fixtureFamilies: ["list-set-ops", "unicode-normalization", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default lineDeduplicatorManifest;
