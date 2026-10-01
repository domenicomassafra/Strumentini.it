import type { ToolManifest } from "../../catalog/manifest";

export const listDifferenceManifest = {
  id: "list-difference",
  route: "/tools/list-difference",
  name: "List Difference",
  summary: "Subtract one line list from another using an explicit equality rule and stable output order.",
  aliases: ["A minus B list", "subtract lists", "items in A not B"],
  jobs: ["subtract lists", "find items absent from B", "remove items from a list"],
  category: "text",
  inputTypes: ["text", "list"],
  implementation: "../tools/list-difference/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-011", fixtureFamilies: ["list-set-ops", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default listDifferenceManifest;
