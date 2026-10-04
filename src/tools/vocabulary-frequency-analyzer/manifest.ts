import type { ToolManifest } from "../../catalog/manifest";

export const vocabularyFrequencyAnalyzerManifest = {
  id: "vocabulary-frequency-analyzer",
  route: "/tools/vocabulary-frequency-analyzer",
  name: "Vocabulary / Frequency Analyzer",
  summary: "Count normalized vocabulary terms with deterministic stop-word and length policies.",
  aliases: ["word frequency", "vocabulary analyzer", "term counter"],
  jobs: ["analyze vocabulary", "count word frequency", "find repeated terms"],
  category: "research",
  inputTypes: ["text", "lines"],
  implementation: "../tools/vocabulary-frequency-analyzer/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-198", fixtureFamilies: ["research-text-frequency", "word-character-line-count"] },
} as const satisfies ToolManifest;

export default vocabularyFrequencyAnalyzerManifest;
