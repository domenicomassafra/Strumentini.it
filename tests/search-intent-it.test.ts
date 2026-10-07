import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { searchCatalog } from "../src/generated/search-catalog";
import { createSearch } from "../src/search/search";

interface SearchIntentCorpus {
  schemaVersion: number;
  requiredAreas: string[];
  positive: Array<{ area: string; query: string; toolId: string; maxRank: number }>;
  zeroResultRecovery: Array<{ query: string; suggestion: string }>;
  deliberateNoTool: string[];
}

const corpus = JSON.parse(
  await readFile(new URL("../quality/fixtures/search-intent-it/corpus.json", import.meta.url), "utf8"),
) as SearchIntentCorpus;

describe("Italian search intent corpus", () => {
  const search = createSearch(searchCatalog);

  it("covers the required Italian intent areas and ranks the declared generated-catalog routes", () => {
    expect(corpus.schemaVersion).toBe(1);
    const areas = new Set(corpus.positive.map(({ area }) => area));
    for (const area of corpus.requiredAreas) expect(areas.has(area)).toBe(true);
    for (const sample of corpus.positive) {
      const hits = search.query(sample.query, undefined, 10).hits;
      const rank = hits.findIndex(({ id }) => id === sample.toolId);
      expect(rank, `${sample.query} should rank ${sample.toolId}`).toBeGreaterThanOrEqual(0);
      expect(rank, `${sample.query} should rank ${sample.toolId} by ${sample.maxRank}`).toBeLessThanOrEqual(sample.maxRank);
    }
  });

  it("keeps historical keywords alongside localized Italian search synonyms", () => {
    const imageFormat = searchCatalog.find(({ id }) => id === "image-format-conversion");
    expect(imageFormat?.keywords).toEqual(expect.arrayContaining([
      "convert image format",
      "converti jpg png",
    ]));

    const metaPreview = searchCatalog.find(({ id }) => id === "meta-preview");
    expect(metaPreview?.keywords).toEqual(expect.arrayContaining([
      "meta description preview",
      "controlla meta seo",
    ]));
  });

  it("uses bounded metadata-derived recovery and does not fabricate unsupported matches", () => {
    for (const sample of corpus.zeroResultRecovery) {
      const result = search.query(sample.query, undefined, 10);
      expect(result.hits, sample.query).toHaveLength(0);
      expect(result.closeIntents, sample.query).toContain(sample.suggestion);
      expect(result.closeIntents.length, sample.query).toBeLessThanOrEqual(4);
    }
    for (const query of corpus.deliberateNoTool) {
      expect(search.query(query, undefined, 10).hits, query).toHaveLength(0);
    }
  });
});
