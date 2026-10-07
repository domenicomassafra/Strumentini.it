import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

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
  result: researchResultV2Declaration("citation-key-generator"),
  handoff: { emits: [{ type: "table", format: "csv" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-188", fixtureFamilies: ["research-citation-identity", "research-bibtex-syntax", "sha2-known-answers"] },
} as const satisfies ToolManifest;

export default citationKeyGeneratorManifest;
