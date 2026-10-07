import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const wordCharacterLineCounterManifest = {
  id: "word-character-line-counter",
  route: "/tools/word-character-line-counter",
  name: "Word, Character & Line Counter",
  summary: "Count words, characters, code points, lines, paragraphs, and UTF-8 bytes locally.",
  aliases: ["word counter", "character counter", "line counter", "text counter"],
  jobs: ["count words", "count characters", "count lines", "measure text length"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/word-character-line-counter/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["word-character-line-counter"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-001", fixtureFamilies: ["word-character-line-count", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default wordCharacterLineCounterManifest;
