import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const bibtexFormatterManifest = {
  id: "bibtex-formatter",
  route: "/tools/bibtex-formatter",
  name: "BibTeX Formatter",
  summary: "Parse and canonically format BibTeX entries with deterministic field order.",
  aliases: ["bibtex pretty printer", "latex bibliography formatter"],
  jobs: ["format bibtex", "normalize bibtex whitespace", "order bibtex fields"],
  category: "research",
  inputTypes: ["file", "text"],
  implementation: "../tools/bibtex-formatter/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("bibtex-formatter"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-185", fixtureFamilies: ["research-bibtex-syntax"] },
} as const satisfies ToolManifest;

export default bibtexFormatterManifest;
