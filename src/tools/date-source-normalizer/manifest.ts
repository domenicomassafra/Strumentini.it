import type { ToolManifest } from "../../catalog/manifest";

export const dateSourceNormalizerManifest = {
  id: "date-source-normalizer",
  route: "/tools/date-source-normalizer",
  name: "Date Source Normalizer",
  summary: "Normalize supported research date spellings to ISO year, month, or day precision.",
  aliases: ["date normalizer", "iso date cleaner"],
  jobs: ["normalize a date", "convert research dates", "validate a date source"],
  category: "research",
  inputTypes: ["date-time", "text"],
  implementation: "../tools/date-source-normalizer/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-193", fixtureFamilies: ["research-date-normalization"] },
} as const satisfies ToolManifest;

export default dateSourceNormalizerManifest;
