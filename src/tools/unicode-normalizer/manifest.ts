import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const unicodeNormalizerManifest = {
  id: "unicode-normalizer",
  route: "/tools/unicode-normalizer",
  name: "Unicode Normalizer",
  summary: "Apply explicit NFC, NFD, NFKC, or NFKD normalization to text without changing it elsewhere.",
  aliases: ["NFC normalizer", "NFD normalizer", "unicode canonical normalization", "normalize accents"],
  jobs: ["normalize unicode", "compare canonical forms", "normalize text encoding"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/unicode-normalizer/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["unicode-normalizer"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-006", fixtureFamilies: ["unicode-normalization", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default unicodeNormalizerManifest;
