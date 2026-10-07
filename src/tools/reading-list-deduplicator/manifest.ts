import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

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
  result: researchResultV2Declaration("reading-list-deduplicator"),
  handoff: { emits: [{ type: "table", format: "csv" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-199", fixtureFamilies: ["research-citation-identity"] },
} as const satisfies ToolManifest;

export default readingListDeduplicatorManifest;
