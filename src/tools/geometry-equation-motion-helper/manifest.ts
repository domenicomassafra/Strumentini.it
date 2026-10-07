import type { ToolManifest } from "../../catalog/manifest";

export const geometryEquationMotionHelperManifest = {
  id: "geometry-equation-motion-helper",
  route: "/tools/geometry-equation-motion-helper",
  name: "Geometry Equation and Motion Helpers",
  summary: "Calculate deterministic geometry, Pythagorean lengths, real quadratic roots and speed-distance-time with explicit units.",
  aliases: ["geometry calculator", "quadratic roots calculator", "speed distance time calculator", "Pythagorean calculator"],
  jobs: ["calculate geometry", "solve quadratic real roots", "calculate speed distance or time"],
  category: "business-math",
  inputTypes: ["number", "unit"],
  implementation: "../tools/geometry-equation-motion-helper/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-222", fixtureFamilies: ["business-math-expansion"] },
} as const satisfies ToolManifest;

export default geometryEquationMotionHelperManifest;
