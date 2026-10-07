import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const bibtexDeduplicatorManifest = {
  id: "bibtex-deduplicator",
  route: "/tools/bibtex-deduplicator",
  name: "BibTeX Deduplicator",
  summary: "Deduplicate parsed BibTeX entries by DOI or title, author, and year.",
  aliases: ["bibtex dedupe", "latex bibliography dedupe"],
  jobs: ["dedupe bibtex", "remove duplicate bibtex entries"],
  category: "research",
  inputTypes: ["file", "text"],
  implementation: "../tools/bibtex-deduplicator/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("bibtex-deduplicator"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-186", fixtureFamilies: ["research-bibtex-syntax"] },
} as const satisfies ToolManifest;

export default bibtexDeduplicatorManifest;
