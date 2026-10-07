import type { ToolManifest } from "../../catalog/manifest";

export const fractionIntegerToolkitManifest = {
  id: "fraction-integer-toolkit",
  route: "/tools/fraction-integer-toolkit",
  name: "Exact Fractions and Integer Toolkit",
  summary: "Calculate exact fractions, GCD/LCM, factorization, combinatorics, canonical Roman numerals, and bounded integer words.",
  aliases: ["fraction calculator", "gcd lcm calculator", "prime factorization", "roman numeral converter"],
  jobs: ["calculate exact fractions", "find gcd lcm and prime factors", "convert canonical Roman numerals", "calculate combinations and permutations"],
  category: "business-math",
  inputTypes: ["integer", "fraction", "text"],
  implementation: "../tools/fraction-integer-toolkit/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-205", fixtureFamilies: ["calculator-math-core"] },
} as const satisfies ToolManifest;

export default fractionIntegerToolkitManifest;
