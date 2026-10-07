import type { ToolManifest } from "../../catalog/manifest";

export const discountImpactManifest = {
  id: "discount-impact",
  route: "/tools/discount-impact",
  name: "Discount Impact Calculator",
  summary: "Show the unit price, revenue, and revenue lost when a quoted discount is applied.",
  aliases: ["discount calculator", "discount revenue impact", "price reduction impact"],
  jobs: ["calculate discount impact", "measure revenue lost to discount", "compare discounted pricing"],
  category: "business-math",
  inputTypes: ["money", "percent", "units"],
  implementation: "../tools/discount-impact/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-113", fixtureFamilies: ["percentage-math"] },
} as const satisfies ToolManifest;

export default discountImpactManifest;
