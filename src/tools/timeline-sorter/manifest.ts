import type { ToolManifest } from "../../catalog/manifest";

export const timelineSorterManifest = {
  id: "timeline-sorter",
  route: "/tools/timeline-sorter",
  name: "Timeline Sorter",
  summary: "Sort dated research events chronologically with stable ordering and invalid-date reporting.",
  aliases: ["event sorter", "chronology sorter"],
  jobs: ["sort a timeline", "order dated events", "check timeline dates"],
  category: "research",
  inputTypes: ["structured", "date-time"],
  implementation: "../tools/timeline-sorter/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-192", fixtureFamilies: ["date-arithmetic"] },
} as const satisfies ToolManifest;

export default timelineSorterManifest;
