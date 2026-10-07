import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const citationDeduplicatorManifest = {
  id: "citation-deduplicator",
  route: "/tools/citation-deduplicator",
  name: "Citation Deduplicator",
  summary: "Remove duplicate citation records using explicit identifier or title-author-year rules.",
  aliases: ["citation dedupe", "reference duplicate finder"],
  jobs: ["dedupe citations", "find duplicate references", "merge citation records"],
  category: "research",
  inputTypes: ["structured", "text"],
  implementation: "../tools/citation-deduplicator/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("citation-deduplicator"),
  handoff: { emits: [{ type: "table", format: "csv" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-184", fixtureFamilies: ["research-citation-identity"] },
} as const satisfies ToolManifest;

export default citationDeduplicatorManifest;
