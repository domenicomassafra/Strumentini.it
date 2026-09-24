import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileCatalog } from "../scripts/lib/catalog-compiler";
import { caseConverterManifest } from "../src/tools/case-converter/manifest";
import { csvColumnToListManifest } from "../src/tools/csv-column-to-list/manifest";
import { findReplacePreviewManifest } from "../src/tools/find-replace-preview/manifest";
import { invisibleCharacterDetectorManifest } from "../src/tools/invisible-character-detector/manifest";
import { languageAwareTextStatisticsManifest } from "../src/tools/language-aware-text-statistics/manifest";
import { lineDeduplicatorManifest } from "../src/tools/line-deduplicator/manifest";
import { lineSorterManifest } from "../src/tools/line-sorter/manifest";
import { listDifferenceManifest } from "../src/tools/list-difference/manifest";
import { listIntersectionManifest } from "../src/tools/list-intersection/manifest";
import { loremSampleDataGeneratorManifest } from "../src/tools/lorem-sample-data-generator/manifest";
import { markdownPreviewManifest } from "../src/tools/markdown-preview/manifest";
import { markdownTableFormatterManifest } from "../src/tools/markdown-table-formatter/manifest";
import { readingTimeEstimatorManifest } from "../src/tools/reading-time-estimator/manifest";
import { slugGeneratorManifest } from "../src/tools/slug-generator/manifest";
import { smartQuoteNormalizerManifest } from "../src/tools/smart-quote-normalizer/manifest";
import { textToCsvRowsManifest } from "../src/tools/text-to-csv-rows/manifest";
import { textDiffManifest } from "../src/tools/text-diff/manifest";
import { unicodeNormalizerManifest } from "../src/tools/unicode-normalizer/manifest";
import { whitespaceNormalizerManifest } from "../src/tools/whitespace-normalizer/manifest";
import { wordCharacterLineCounterManifest } from "../src/tools/word-character-line-counter/manifest";

const textManifests = [
  wordCharacterLineCounterManifest,
  readingTimeEstimatorManifest,
  caseConverterManifest,
  whitespaceNormalizerManifest,
  invisibleCharacterDetectorManifest,
  unicodeNormalizerManifest,
  smartQuoteNormalizerManifest,
  lineSorterManifest,
  lineDeduplicatorManifest,
  listIntersectionManifest,
  listDifferenceManifest,
  findReplacePreviewManifest,
  textDiffManifest,
  markdownPreviewManifest,
  markdownTableFormatterManifest,
  slugGeneratorManifest,
  textToCsvRowsManifest,
  csvColumnToListManifest,
  loremSampleDataGeneratorManifest,
  languageAwareTextStatisticsManifest,
] as const;

describe("20-tool text and writing catalog family", () => {
  it("compiles all 20 candidates as independent LOCAL routes", () => {
    const compiled = compileCatalog(textManifests);
    expect(compiled.summaries).toHaveLength(20);
    expect(new Set(compiled.summaries.map(({ id }) => id)).size).toBe(20);
    expect(new Set(compiled.summaries.map(({ route }) => route)).size).toBe(20);
    for (const summary of compiled.summaries) {
      expect(summary.route).toBe(`/tools/${summary.id}`);
      expect(summary.category).toBe("text");
      expect(summary.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
      expect(summary.aliases.length).toBeGreaterThan(0);
      expect(summary.jobs.length).toBeGreaterThan(0);
    }
  });

  it("gives every candidate a distinct lazy module implementation", () => {
    const compiled = compileCatalog(textManifests);
    expect(new Set(compiled.loaders.map(({ implementation }) => implementation)).size).toBe(20);
    expect(compiled.loaders.every(({ implementation }) => implementation.endsWith("/module.ts"))).toBe(true);
  });

  it("retains the existing text diff as the thirteenth candidate", () => {
    expect(textManifests.map(({ id }) => id)).toContain("text-diff");
    expect(textDiffManifest.gold.oracleEntryId).toBe("cand-013");
  });

  it("has an openable route, module, and component for every candidate", () => {
    const componentById: Record<string, string> = {
      "word-character-line-counter": "WordCharacterLineCounterTool.tsx",
      "reading-time-estimator": "ReadingTimeEstimatorTool.tsx",
      "case-converter": "CaseConverterTool.tsx",
      "whitespace-normalizer": "WhitespaceNormalizerTool.tsx",
      "invisible-character-detector": "InvisibleCharacterDetectorTool.tsx",
      "unicode-normalizer": "UnicodeNormalizerTool.tsx",
      "smart-quote-normalizer": "SmartQuoteNormalizerTool.tsx",
      "line-sorter": "LineSorterTool.tsx",
      "line-deduplicator": "LineDeduplicatorTool.tsx",
      "list-intersection": "ListIntersectionTool.tsx",
      "list-difference": "ListDifferenceTool.tsx",
      "find-replace-preview": "FindReplacePreviewTool.tsx",
      "text-diff": "TextDiffTool.tsx",
      "markdown-preview": "MarkdownPreviewTool.tsx",
      "markdown-table-formatter": "MarkdownTableFormatterTool.tsx",
      "slug-generator": "SlugGeneratorTool.tsx",
      "text-to-csv-rows": "TextToCsvRowsTool.tsx",
      "csv-column-to-list": "CsvColumnToListTool.tsx",
      "lorem-sample-data-generator": "LoremSampleDataGeneratorTool.tsx",
      "language-aware-text-statistics": "LanguageAwareTextStatisticsTool.tsx",
    };
    for (const manifest of textManifests) {
      expect(existsSync(new URL(`../src/tools/${manifest.id}/module.ts`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../src/pages/tools/${manifest.id}.astro`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../src/components/tools/${componentById[manifest.id]}`, import.meta.url))).toBe(true);
    }
  });
});
