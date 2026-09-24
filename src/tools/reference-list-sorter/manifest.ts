import type { ToolManifest } from "../../catalog/manifest";

export const referenceListSorterManifest = {
  id: "reference-list-sorter",
  route: "/tools/reference-list-sorter",
  name: "Reference List Sorter",
  summary: "Sort reference records stably by author, year, or title.",
  aliases: ["bibliography sorter", "reference sorter"],
  jobs: ["sort references", "sort a bibliography", "order citations"],
  category: "research",
  inputTypes: ["structured", "text"],
  implementation: "../tools/reference-list-sorter/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "D", oracleEntryId: "cand-189", fixtureFamilies: ["line-sorting"] },
} as const satisfies ToolManifest;

export default referenceListSorterManifest;
