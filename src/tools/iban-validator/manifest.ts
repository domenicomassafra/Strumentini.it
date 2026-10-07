import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const ibanValidatorManifest = {
  id: "iban-validator",
  route: "/tools/iban-validator",
  name: "IBAN Validator",
  summary: "Normalize and formally validate supported IBANs with MOD-97, including structural Italian CIN/ABI/CAB/account decomposition.",
  aliases: ["iban validator", "iban checker", "italian iban parser", "mod 97 iban"],
  jobs: ["validate an IBAN locally", "check IBAN MOD-97", "parse Italian IBAN coordinates"],
  category: "business-math",
  inputTypes: ["identifier", "text"],
  implementation: "../tools/iban-validator/module.ts",
  engine: "research-reference",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("iban-validator"),
  gold: {
    maintenanceClass: "R",
    oracleEntryId: "cand-209",
    fixtureFamilies: ["iban-formal-validation"],
  },
} as const satisfies ToolManifest;

export default ibanValidatorManifest;
