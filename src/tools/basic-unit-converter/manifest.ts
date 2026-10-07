import type { ToolManifest } from "../../catalog/manifest";

export const basicUnitConverterManifest = {
  id: "basic-unit-converter",
  route: "/tools/basic-unit-converter",
  name: "Basic Unit Converter",
  summary: "Convert physical units plus contextual px↔rem/em with explicit font-size inputs, dimension checks, affine temperature support, and bounded decimal precision.",
  aliases: ["unit converter", "length converter", "temperature converter", "mass converter", "px to rem", "rem to px", "px to em", "em to px"],
  jobs: ["convert length units", "convert mass units", "convert temperatures", "convert area and volume units", "convert px and rem", "convert px and em"],
  category: "business-math",
  inputTypes: ["decimal", "unit"],
  implementation: "../tools/basic-unit-converter/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-214", fixtureFamilies: ["unit-conversion-core"] },
} as const satisfies ToolManifest;

export default basicUnitConverterManifest;
