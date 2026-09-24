import type { ToolManifest } from "../../catalog/manifest";

export const risBibtexConverterManifest = {
  id: "ris-bibtex-converter",
  route: "/tools/ris-bibtex-converter",
  name: "RIS / BibTeX Converter",
  summary: "Convert between local RIS records and BibTeX without metadata lookup or uploads.",
  aliases: ["ris converter", "bibtex converter", "ris import export"],
  jobs: ["convert ris to bibtex", "convert bibtex to ris", "map reference metadata"],
  category: "research",
  inputTypes: ["file", "text"],
  implementation: "../tools/ris-bibtex-converter/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "D", oracleEntryId: "cand-187", fixtureFamilies: ["bibtex", "ris"] },
} as const satisfies ToolManifest;

export default risBibtexConverterManifest;
