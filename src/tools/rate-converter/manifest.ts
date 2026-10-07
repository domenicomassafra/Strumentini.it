import type { ToolManifest } from "../../catalog/manifest";

export const rateConverterManifest = {
  id: "rate-converter",
  route: "/tools/rate-converter",
  name: "Rate Converter",
  summary: "Convert hour, day, and project rates using explicit work-basis assumptions and final-only decimal rounding.",
  aliases: ["hourly rate converter", "day rate converter", "project rate converter"],
  jobs: ["convert hourly to daily rate", "convert project to hourly rate", "compare client rates"],
  category: "client-work-math",
  inputTypes: ["decimal", "rate-unit"],
  implementation: "../tools/rate-converter/module.ts",
  engine: "client-time-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [
    { key: "currency" },
    { key: "hoursPerDay", defaultValue: "8" },
  ],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-101",
    fixtureFamilies: ["business-math"],
  },
} as const satisfies ToolManifest;

export default rateConverterManifest;
