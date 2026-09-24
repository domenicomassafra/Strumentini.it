import type { ToolManifest } from "../../catalog/manifest";

export const invoiceMathValidatorManifest = {
  id: "invoice-math-validator",
  route: "/tools/invoice-math-validator",
  name: "Invoice Math Validator",
  summary: "Recalculate invoice discounts and tax, then compare the expected total with the entered total.",
  aliases: ["invoice total validator", "invoice tax checker", "invoice arithmetic check"],
  jobs: ["validate invoice math", "check invoice total", "recalculate invoice tax"],
  category: "business-math",
  inputTypes: ["money", "percent", "invoice"],
  implementation: "../tools/invoice-math-validator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-118", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default invoiceMathValidatorManifest;
