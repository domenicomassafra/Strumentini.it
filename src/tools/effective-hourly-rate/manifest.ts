import type { ToolManifest } from "../../catalog/manifest";

export const effectiveHourlyRateManifest = {
  id: "effective-hourly-rate",
  route: "/tools/effective-hourly-rate",
  name: "Effective Hourly Rate",
  summary: "Turn revenue and work costs into a transparent effective hourly rate with exact decimal arithmetic.",
  aliases: ["effective hourly rate calculator", "real hourly rate", "net hourly rate"],
  jobs: ["calculate effective hourly rate", "include costs in hourly rate", "compare net hourly earnings"],
  category: "business-math",
  inputTypes: ["money", "decimal", "hours"],
  implementation: "../tools/effective-hourly-rate/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-102", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default effectiveHourlyRateManifest;
