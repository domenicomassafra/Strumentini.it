import type { ToolManifest } from "../../catalog/manifest";

export const referenceSizeConverterManifest = {
  id: "reference-size-converter",
  route: "/tools/reference-size-converter",
  name: "Reference Size Conversion Helpers",
  summary: "Convert ISO paper sizes, model scales, and TV diagonal geometry while refusing unsourced clothing or shoe fit claims.",
  aliases: ["A4 size converter", "model scale calculator", "TV diagonal dimensions"],
  jobs: ["convert ISO paper size", "calculate model scale", "calculate TV width height diagonal"],
  category: "business-math",
  inputTypes: ["decimal", "length-unit", "reference-size"],
  implementation: "../tools/reference-size-converter/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-218", fixtureFamilies: ["unit-conversion-core"] },
} as const satisfies ToolManifest;

export default referenceSizeConverterManifest;
