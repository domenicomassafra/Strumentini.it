import type { ToolManifest } from "../../catalog/manifest";

export const invoiceNumberGeneratorManifest = {
  id: "invoice-number-generator",
  route: "/tools/invoice-number-generator",
  name: "Invoice Number Generator",
  summary: "Build a deterministic invoice number from a prefix, year, sequence, padding, and separator.",
  aliases: ["invoice numbering", "invoice sequence generator", "invoice reference generator"],
  jobs: ["generate invoice number", "format invoice sequence", "preview invoice reference"],
  category: "business-math",
  inputTypes: ["text", "integer", "year"],
  implementation: "../tools/invoice-number-generator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-117", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default invoiceNumberGeneratorManifest;
