import type { ToolManifest } from "../../catalog/manifest";

export const engineeringUnitConverterManifest = {
  id: "engineering-unit-converter",
  route: "/tools/engineering-unit-converter",
  name: "Engineering Unit Converter",
  summary: "Convert common engineering dimensions through the shared unit registry with explicit source notes and alias-collision handling.",
  aliases: ["engineering converter", "pressure converter", "energy converter", "force torque converter"],
  jobs: ["convert engineering units", "convert pressure and energy", "convert force torque power and flow"],
  category: "business-math",
  inputTypes: ["decimal", "unit"],
  implementation: "../tools/engineering-unit-converter/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-215", fixtureFamilies: ["unit-conversion-core"] },
} as const satisfies ToolManifest;

export default engineeringUnitConverterManifest;
