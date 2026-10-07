import type { ToolManifest } from "../../catalog/manifest";

export const latePaymentInterestManifest = {
  id: "late-payment-interest",
  route: "/tools/late-payment-interest",
  name: "Late-payment Interest Calculator",
  summary: "Calculate simple interest and total due for an overdue payment using a declared day-count basis.",
  aliases: ["late payment calculator", "overdue interest", "payment interest"],
  jobs: ["calculate late payment interest", "estimate overdue charges", "total an overdue invoice"],
  category: "business-math",
  inputTypes: ["money", "percent", "days"],
  implementation: "../tools/late-payment-interest/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "R", oracleEntryId: "cand-112", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default latePaymentInterestManifest;
