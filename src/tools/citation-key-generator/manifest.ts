import type { ToolManifest } from "../../catalog/manifest";

export const citationKeyGeneratorManifest = {
  id: "citation-key-generator",
  route: "/tools/citation-key-generator",
  name: "Citation Key Generator",
  summary: "Generate stable author-year-title citation keys with collision suffixes.",
  aliases: ["bibtex key generator", "citationkey builder"],
  jobs: ["generate a citation key", "make a bibtex key", "avoid citation key collisions"],
  category: "research",
  inputTypes: ["structured", "text"],
  implementation: "../tools/citation-key-generator/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-188", fixtureFamilies: ["research-citation-identity", "research-bibtex-syntax", "sha2-known-answers"] },
} as const satisfies ToolManifest;

export default citationKeyGeneratorManifest;
