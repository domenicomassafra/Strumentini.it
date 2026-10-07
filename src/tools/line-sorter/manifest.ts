import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const lineSorterManifest = {
  id: "line-sorter",
  route: "/tools/line-sorter",
  name: "Line Sorter",
  summary: "Sort line lists in stable ascending or descending order with explicit case-sensitivity.",
  aliases: ["sort lines", "alphabetize lines", "line list sorter"],
  jobs: ["sort lines", "alphabetize a list", "order line items"],
  category: "text",
  inputTypes: ["text", "list"],
  implementation: "../tools/line-sorter/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["line-sorter"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-008", fixtureFamilies: ["line-sorting", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default lineSorterManifest;
