import type { ToolManifest } from "../../catalog/manifest";

export const listCompareManifest = {
  id: "list-compare",
  route: "/tools/list-compare",
  name: "List Compare & Dedupe",
  summary: "Compare, intersect, subtract, and deduplicate line lists with explicit equality rules.",
  aliases: ["list dedupe", "list difference", "list intersection", "line deduplicator"],
  jobs: ["compare lists", "deduplicate lines", "find common list items", "find list differences"],
  category: "text",
  inputTypes: ["text", "list"],
  implementation: "../tools/list-compare/module.ts",
  engine: "text-list",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-009",
    fixtureFamilies: ["list-set-ops", "unicode-normalization", "whitespace-normalization"],
  },
} as const satisfies ToolManifest;

export default listCompareManifest;
