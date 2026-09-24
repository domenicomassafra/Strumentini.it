import type { ToolManifest } from "../../catalog/manifest";

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
  gold: { maintenanceClass: "D", oracleEntryId: "cand-186", fixtureFamilies: ["bibtex"] },
} as const satisfies ToolManifest;

export default bibtexDeduplicatorManifest;
