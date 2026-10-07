import type { ToolManifest } from "../../catalog/manifest";

export const trackingCleanerManifest = {
  id: "tracking-cleaner",
  route: "/tools/tracking-cleaner",
  name: "Tracking Parameter Cleaner",
  summary: "Remove known campaign and click-tracking parameters while preserving unrelated repeated parameters and fragments.",
  aliases: ["utm remover", "tracking url cleaner", "clean campaign url"],
  jobs: ["remove tracking parameters", "clean a url", "strip utm parameters"],
  category: "marketing",
  inputTypes: ["url"],
  implementation: "../tools/tracking-cleaner/module.ts",
  engine: "campaign-url",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-063", fixtureFamilies: ["utm-roundtrip", "query-params"] },
} as const satisfies ToolManifest;

export default trackingCleanerManifest;
