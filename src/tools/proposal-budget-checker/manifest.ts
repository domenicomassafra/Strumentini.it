import type { ToolManifest } from "../../catalog/manifest";

export const proposalBudgetCheckerManifest = {
  id: "proposal-budget-checker",
  route: "/tools/proposal-budget-checker",
  name: "Proposal Budget Checker",
  summary: "Check whether a quoted price covers labor, direct costs, contingency, and a target margin.",
  aliases: ["proposal budget calculator", "quote margin checker", "project budget sanity check"],
  jobs: ["check proposal budget", "calculate quote margin", "price a project against target margin"],
  category: "business-math",
  inputTypes: ["money", "hours", "percent"],
  implementation: "../tools/proposal-budget-checker/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-114", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default proposalBudgetCheckerManifest;
