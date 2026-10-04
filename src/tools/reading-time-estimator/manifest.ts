import type { ToolManifest } from "../../catalog/manifest";

export const readingTimeEstimatorManifest = {
  id: "reading-time-estimator",
  route: "/tools/reading-time-estimator",
  name: "Reading-Time Estimator",
  summary: "Estimate reading time from a configurable words-per-minute rate without uploading text.",
  aliases: ["reading time", "read time estimator", "how long to read"],
  jobs: ["estimate reading time", "calculate read duration", "preview article length"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/reading-time-estimator/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-002", fixtureFamilies: ["word-character-line-count", "text-writing-local-jobs"] },
} as const satisfies ToolManifest;

export default readingTimeEstimatorManifest;
