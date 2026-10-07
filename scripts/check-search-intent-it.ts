import { readFile } from "node:fs/promises";
import { searchCatalog } from "../src/generated/search-catalog";
import { createSearch } from "../src/search/search";

const corpus = JSON.parse(
  await readFile(new URL("../quality/fixtures/search-intent-it/corpus.json", import.meta.url), "utf8"),
) as {
  schemaVersion: number;
  requiredAreas: string[];
  positive: Array<{ area: string; query: string; toolId: string; maxRank: number }>;
  zeroResultRecovery: Array<{ query: string; suggestion: string }>;
  deliberateNoTool: string[];
};
const search = createSearch(searchCatalog);
const failures: string[] = [];
const catalogIds = new Set<string>(searchCatalog.map(({ id }) => id));
const observedAreas = new Set(corpus.positive.map(({ area }) => area));

if (corpus.schemaVersion !== 1) failures.push(`unsupported corpus schemaVersion ${String(corpus.schemaVersion)}`);
for (const area of corpus.requiredAreas) {
  if (!observedAreas.has(area)) failures.push(`missing required intent area: ${area}`);
}

for (const sample of corpus.positive) {
  if (!catalogIds.has(sample.toolId)) {
    failures.push(sample.query + ": target tool is absent from generated search catalog: " + sample.toolId);
    continue;
  }
  const hits = search.query(sample.query, undefined, 10).hits;
  const rank = hits.findIndex((hit) => hit.id === sample.toolId);
  if (rank < 0 || rank > sample.maxRank) {
    failures.push(sample.query + ": expected " + sample.toolId + " by rank " + String(sample.maxRank) + ", got " + hits.slice(0, 4).map((hit) => hit.id).join(", "));
  }
}
for (const sample of corpus.zeroResultRecovery) {
  const result = search.query(sample.query, undefined, 10);
  if (result.hits.length !== 0 || !result.closeIntents.includes(sample.suggestion) || result.closeIntents.length > 4) {
    failures.push(sample.query + ": invalid zero-result recovery " + JSON.stringify(result.closeIntents));
  }
}
for (const query of corpus.deliberateNoTool) {
  const result = search.query(query, undefined, 10);
  if (result.hits.length !== 0) {
    failures.push(query + ": deliberately unsupported intent fabricated matches: " + result.hits.slice(0, 4).map((hit) => hit.id).join(", "));
  }
}
if (failures.length > 0) throw new Error("Italian search-intent gate failed:\n- " + failures.join("\n- "));
console.log(
  "Italian search-intent gate PASS:",
  corpus.positive.length,
  "ranked intents +",
  corpus.zeroResultRecovery.length,
  "zero-result recoveries +",
  corpus.deliberateNoTool.length,
  "deliberately unsupported intents",
);
