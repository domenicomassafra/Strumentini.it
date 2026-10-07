import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const isbnValidatorConverterManifest = {
  id: "isbn-validator-converter",
  route: "/tools/isbn-validator-converter",
  name: "ISBN Validator / Converter",
  summary: "Validate ISBN-10 and ISBN-13 check digits and convert valid ISBN-10 values locally.",
  aliases: ["isbn check-digit validator", "isbn10 to isbn13 converter", "isbn check digit"],
  jobs: ["verify an isbn check digit", "derive isbn13 from isbn10", "inspect isbn digits"],
  category: "research",
  inputTypes: ["identifier", "text"],
  implementation: "../tools/isbn-validator-converter/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("isbn-validator-converter"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-183", fixtureFamilies: ["isbn"] },
} as const satisfies ToolManifest;

export default isbnValidatorConverterManifest;
