import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const textDiffManifest = {
  id: "text-diff",
  route: "/tools/text-diff",
  name: "Text Diff",
  summary: "Compare two texts line by line with explicit unchanged, removed, and added operations.",
  aliases: ["line diff", "compare text", "text compare"],
  jobs: ["diff text", "compare text versions", "find added and removed lines"],
  category: "text",
  inputTypes: ["text"],
  implementation: "../tools/text-diff/module.ts",
  engine: "text-list",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["text-diff"],
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-013",
    fixtureFamilies: ["text-diff", "whitespace-normalization"],
  },
} as const satisfies ToolManifest;

export default textDiffManifest;
