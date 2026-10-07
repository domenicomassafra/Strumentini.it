import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const partitaIvaValidatorManifest = {
  id: "partita-iva-validator",
  route: "/tools/partita-iva-validator",
  name: "Partita IVA Validator",
  summary: "Normalize and validate the formal 11-digit Italian Partita IVA checksum locally without checking registry existence.",
  aliases: ["partita iva validator", "p iva checksum", "italian vat number validator"],
  jobs: ["validate an Italian Partita IVA checksum", "normalize an Italian VAT number", "identify a failing Partita IVA rule"],
  category: "business-math",
  inputTypes: ["identifier", "text"],
  implementation: "../tools/partita-iva-validator/module.ts",
  engine: "research-reference",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("partita-iva-validator"),
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-208",
    fixtureFamilies: ["italian-vat-number"],
  },
} as const satisfies ToolManifest;

export default partitaIvaValidatorManifest;
