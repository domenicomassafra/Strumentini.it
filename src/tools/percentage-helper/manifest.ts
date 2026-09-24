import type { ToolManifest } from "../../catalog/manifest";

export const percentageHelperManifest = {
  id: "percentage-helper",
  route: "/tools/percentage-helper",
  name: "VAT / General Percentage Helper",
  summary: "Add a percentage to a base or reverse-calculate the net amount from an inclusive total.",
  aliases: ["VAT calculator", "percentage calculator", "tax percentage helper", "reverse percentage"],
  jobs: ["calculate percentage of base", "reverse calculate VAT", "extract percentage from total"],
  category: "business-math",
  inputTypes: ["money", "percent", "decimal"],
  implementation: "../tools/percentage-helper/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  gold: { maintenanceClass: "R", oracleEntryId: "cand-119", fixtureFamilies: ["percentage-math"] },
} as const satisfies ToolManifest;

export default percentageHelperManifest;
