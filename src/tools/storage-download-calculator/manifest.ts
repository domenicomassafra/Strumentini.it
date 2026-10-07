import type { ToolManifest } from "../../catalog/manifest";

export const storageDownloadCalculatorManifest = {
  id: "storage-download-calculator",
  route: "/tools/storage-download-calculator",
  name: "Digital Storage and Download Time Calculator",
  summary: "Convert SI and IEC storage units and estimate download time from user-entered throughput with explicit bit/byte and overhead assumptions.",
  aliases: ["MB MiB converter", "download time calculator", "bit byte converter"],
  jobs: ["convert storage units", "compare decimal and binary storage", "estimate download time"],
  category: "business-math",
  inputTypes: ["decimal", "storage-unit", "data-rate"],
  implementation: "../tools/storage-download-calculator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-216", fixtureFamilies: ["unit-conversion-core"] },
} as const satisfies ToolManifest;

export default storageDownloadCalculatorManifest;
