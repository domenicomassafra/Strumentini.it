import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const quoteCounterManifest = {
  id: "quote-counter",
  route: "/tools/quote-counter",
  name: "Quote Word / Character Counter",
  summary: "Count words, Unicode code points, non-whitespace characters, lines, and reading time.",
  aliases: ["quote counter", "word character count", "quote length calculator"],
  jobs: ["count quote words", "count quote characters", "compare quote length"],
  category: "research",
  inputTypes: ["text"],
  implementation: "../tools/quote-counter/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("quote-counter"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-191", fixtureFamilies: ["word-character-line-count"] },
} as const satisfies ToolManifest;

export default quoteCounterManifest;
