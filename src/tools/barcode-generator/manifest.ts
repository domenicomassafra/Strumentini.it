import type { ToolManifest } from "../../catalog/manifest";

export const barcodeGeneratorManifest = {
  id: "barcode-generator",
  route: "/tools/barcode-generator",
  name: "Barcode Generator",
  summary: "Generate or validate EAN-13 and generate a documented printable-ASCII Code 128 B subset locally, with SVG and PNG export.",
  aliases: ["ean 13 generator", "code 128 barcode", "barcode svg", "barcode png"],
  jobs: ["generate an EAN-13 barcode", "validate an EAN-13 check digit", "generate a Code 128 B barcode"],
  category: "marketing",
  inputTypes: ["digits", "text"],
  implementation: "../tools/barcode-generator/module.ts",
  engine: "barcode-linear-v1",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "image", capabilities: ["download", "reset", "provenance"] },
  deterministic: true,
  gold: { maintenanceClass: "E", oracleEntryId: "cand-246", fixtureFamilies: ["barcode-linear"] },
} as const satisfies ToolManifest;

export default barcodeGeneratorManifest;
