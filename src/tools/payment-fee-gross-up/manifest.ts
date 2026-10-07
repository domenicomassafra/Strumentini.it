import type { ToolManifest } from "../../catalog/manifest";

export const paymentFeeGrossUpManifest = {
  id: "payment-fee-gross-up",
  route: "/tools/payment-fee-gross-up",
  name: "Payment-fee Gross-up",
  summary: "Gross up a target net payment so a stated processing fee still leaves the intended amount.",
  aliases: ["payment fee calculator", "processor fee gross-up", "net payment calculator"],
  jobs: ["gross up payment fee", "calculate gross charge", "protect net payment"],
  category: "business-math",
  inputTypes: ["money", "percent", "decimal"],
  implementation: "../tools/payment-fee-gross-up/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-111", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default paymentFeeGrossUpManifest;
