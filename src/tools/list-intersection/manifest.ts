import type { ToolManifest } from "../../catalog/manifest";

export const listIntersectionManifest = {
  id: "list-intersection",
  route: "/tools/list-intersection",
  name: "List Intersection",
  summary: "Find lines present in both lists while preserving stable first-seen order.",
  aliases: ["shared list items", "common list items", "compare lists intersection"],
  jobs: ["intersect lists", "find shared list items", "compare two lists"],
  category: "text",
  inputTypes: ["text", "list"],
  implementation: "../tools/list-intersection/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-010", fixtureFamilies: ["list-set-ops"] },
} as const satisfies ToolManifest;

export default listIntersectionManifest;
