import type { ToolManifest } from "../../catalog/manifest";

export const campaignNameManifest = {
  id: "campaign-name",
  route: "/tools/campaign-name",
  name: "Campaign Name Builder",
  summary: "Build campaign names from a small saved field order and separator that you control.",
  aliases: ["campaign naming", "ad campaign name generator"],
  jobs: ["name a campaign", "apply campaign naming convention", "build campaign identifier"],
  category: "marketing",
  inputTypes: ["text"],
  implementation: "../tools/campaign-name/module.ts",
  engine: "campaign-url",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-068", fixtureFamilies: ["utm-roundtrip"] },
} as const satisfies ToolManifest;

export default campaignNameManifest;
