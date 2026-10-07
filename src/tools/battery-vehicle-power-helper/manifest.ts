import type { ToolManifest } from "../../catalog/manifest";

export const batteryVehiclePowerManifest = {
  id: "battery-vehicle-power-helper",
  route: "/tools/battery-vehicle-power-helper",
  name: "Battery Vehicle and Power Conversion Helpers",
  summary: "Convert mAh and Wh with required voltage, fuel-consumption systems with explicit gallon definitions, and kW/CV/hp with declared constants.",
  aliases: ["mAh Wh converter", "mpg l per 100km converter", "kW CV hp converter"],
  jobs: ["convert battery capacity", "convert fuel consumption", "convert vehicle power units"],
  category: "business-math",
  inputTypes: ["decimal", "voltage", "unit"],
  implementation: "../tools/battery-vehicle-power-helper/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-217", fixtureFamilies: ["unit-conversion-core"] },
} as const satisfies ToolManifest;

export default batteryVehiclePowerManifest;
