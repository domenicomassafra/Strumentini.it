import type { ToolManifest } from "../../catalog/manifest";

export const retainerCapacityManifest = {
  id: "retainer-capacity",
  route: "/tools/retainer-capacity",
  name: "Retainer-capacity Calculator",
  summary: "Estimate how many retainer clients fit into a declared delivery-capacity budget.",
  aliases: ["retainer capacity calculator", "retainer client capacity", "retainer pricing capacity"],
  jobs: ["calculate retainer capacity", "estimate retainer clients", "price retainer delivery"],
  category: "business-math",
  inputTypes: ["money", "hours", "decimal"],
  implementation: "../tools/retainer-capacity/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-106", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default retainerCapacityManifest;
