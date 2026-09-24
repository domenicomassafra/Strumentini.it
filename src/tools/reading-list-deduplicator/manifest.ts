import type { ToolManifest } from "../../catalog/manifest";

export const readingListDeduplicatorManifest = {
  id: "reading-list-deduplicator",
  route: "/tools/reading-list-deduplicator",
  name: "Reading List Deduplicator",
  summary: "Deduplicate reading-list records by DOI, ISBN, URL, or title-author-year identity.",
  aliases: ["reading list dedupe", "bookmark duplicate finder"],
  jobs: ["dedupe a reading list", "remove duplicate sources", "merge reading items"],
  category: "research",
  inputTypes: ["structured", "text"],
  implementation: "../tools/reading-list-deduplicator/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "D", oracleEntryId: "cand-199", fixtureFamilies: ["list-set-ops"] },
} as const satisfies ToolManifest;

export default readingListDeduplicatorManifest;
