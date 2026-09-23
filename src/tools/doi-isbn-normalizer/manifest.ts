import type { ToolManifest } from "../../catalog/manifest";

export const doiIsbnNormalizerManifest = {
  id: "doi-isbn-normalizer",
  route: "/tools/doi-isbn-normalizer",
  name: "DOI / ISBN Normalizer",
  summary: "Normalize DOI presentation and validate ISBN-10/13 syntax and check digits without metadata lookup.",
  aliases: ["doi normalizer", "isbn validator", "isbn converter", "doi link builder"],
  jobs: ["normalize a doi", "validate an isbn", "convert isbn-10 to isbn-13", "build a doi link"],
  category: "research",
  inputTypes: ["identifier", "text"],
  implementation: "../tools/doi-isbn-normalizer/module.ts",
  engine: "research-reference",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-181",
    fixtureFamilies: ["doi", "isbn"],
  },
} as const satisfies ToolManifest;

export default doiIsbnNormalizerManifest;
