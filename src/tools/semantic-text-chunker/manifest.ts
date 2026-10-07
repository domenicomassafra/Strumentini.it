import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const semanticTextChunkerManifest = {
  id: "semantic-text-chunker",
  route: "/tools/semantic-text-chunker",
  name: "Reversible Semantic Text Chunker",
  summary: "Split text at stable paragraph and sentence boundaries while preserving an exact source join and separate overlap context.",
  aliases: ["semantic chunker", "split text into chunks", "reversible text chunks"],
  jobs: ["split long text into stable chunks", "prepare text chunks with reversible boundaries"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/semantic-text-chunker/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["semantic-text-chunker"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-231", fixtureFamilies: ["text-expansion"] },
} as const satisfies ToolManifest;

export default semanticTextChunkerManifest;
