import type { ToolManifest } from "../../catalog/manifest";

export const targetIncomeRateManifest = {
  id: "target-income-rate",
  route: "/tools/target-income-rate",
  name: "Target-income Rate Calculator",
  summary: "Find the billable hourly rate needed to reach a target income after expenses and non-billable time.",
  aliases: ["target income calculator", "required hourly rate", "income target rate"],
  jobs: ["calculate target hourly rate", "price around non-billable time", "plan income against expenses"],
  category: "business-math",
  inputTypes: ["money", "decimal", "hours"],
  implementation: "../tools/target-income-rate/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [
    { key: "currency", defaultValue: "USD" },
    { key: "hoursPerDay", defaultValue: "8" },
  ],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-103", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default targetIncomeRateManifest;
