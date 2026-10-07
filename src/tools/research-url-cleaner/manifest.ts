import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const researchUrlCleanerManifest = {
  id: "research-url-cleaner",
  route: "/tools/research-url-cleaner",
  name: "Research URL Cleaner",
  summary: "Remove common tracking parameters and sort query keys in research URLs locally.",
  aliases: ["source url cleaner", "citation url cleaner"],
  jobs: ["clean a research url", "strip research tracking keys", "canonicalize a source link"],
  category: "research",
  inputTypes: ["url", "text"],
  implementation: "../tools/research-url-cleaner/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("research-url-cleaner"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-194", fixtureFamilies: ["query-params", "url-percent-encoding"] },
} as const satisfies ToolManifest;

export default researchUrlCleanerManifest;
