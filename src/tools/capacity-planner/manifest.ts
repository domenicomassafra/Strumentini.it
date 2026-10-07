import type { ToolManifest } from "../../catalog/manifest";

export const capacityPlannerManifest = {
  id: "capacity-planner",
  route: "/tools/capacity-planner",
  name: "Capacity Planner",
  summary: "Turn available hours and a utilization target into planned billable and deliverable capacity.",
  aliases: ["capacity planning calculator", "available capacity", "delivery capacity"],
  jobs: ["plan billable capacity", "reserve delivery hours", "set utilization target"],
  category: "business-math",
  inputTypes: ["hours", "decimal", "percent"],
  implementation: "../tools/capacity-planner/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-105", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default capacityPlannerManifest;
