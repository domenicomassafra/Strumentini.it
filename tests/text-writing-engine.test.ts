import { describe, expect, it } from "vitest";
import {
  convertTextCase,
  csvColumnToList,
  deduplicateLines,
  differenceLists,
  estimateReadingTime,
  findInvisibleCharacters,
  formatMarkdownTable,
  generateSampleData,
  generateSlug,
  inspectText,
  intersectLists,
  languageStatistics,
  normalizeQuotes,
  normalizeUnicode,
  normalizeWhitespace,
  previewFindReplace,
  renderMarkdown,
  sortLines,
  textToCsv,
} from "../src/engines/text-writing";
import caseConverterModule from "../src/tools/case-converter/module";
import invisibleCharacterDetectorModule from "../src/tools/invisible-character-detector/module";
import csvColumnToListModule from "../src/tools/csv-column-to-list/module";
import findReplaceModule from "../src/tools/find-replace-preview/module";
import languageStatisticsModule from "../src/tools/language-aware-text-statistics/module";
import readingTimeEstimatorModule from "../src/tools/reading-time-estimator/module";
import smartQuoteNormalizerModule from "../src/tools/smart-quote-normalizer/module";
import unicodeNormalizerModule from "../src/tools/unicode-normalizer/module";
import whitespaceNormalizerModule from "../src/tools/whitespace-normalizer/module";
import wordCharacterLineCounterModule from "../src/tools/word-character-line-counter/module";
import lineDeduplicatorModule from "../src/tools/line-deduplicator/module";
import lineSorterModule from "../src/tools/line-sorter/module";
import listDifferenceModule from "../src/tools/list-difference/module";
import listIntersectionModule from "../src/tools/list-intersection/module";
import markdownPreviewModule from "../src/tools/markdown-preview/module";
import markdownTableModule from "../src/tools/markdown-table-formatter/module";
import sampleDataModule from "../src/tools/lorem-sample-data-generator/module";
import slugModule from "../src/tools/slug-generator/module";
import textToCsvModule from "../src/tools/text-to-csv-rows/module";
import textDiffModule from "../src/tools/text-diff/module";
import semanticTextChunkerModule from "../src/tools/semantic-text-chunker/module";
import factSensitiveTextDiffModule from "../src/tools/fact-sensitive-text-diff/module";
import stablePlaceholderAnonymizerModule from "../src/tools/stable-placeholder-anonymizer/module";
import italianGulpeaseReadabilityModule from "../src/tools/italian-gulpease-readability/module";
import mojibakeRepairModule from "../src/tools/mojibake-repair/module";
import pdfCopyTextReflowModule from "../src/tools/pdf-copy-text-reflow/module";
import phoneLinkHashtagMentionExtractorModule from "../src/tools/phone-link-hashtag-mention-extractor/module";

const modules = [
  wordCharacterLineCounterModule,
  readingTimeEstimatorModule,
  caseConverterModule,
  whitespaceNormalizerModule,
  invisibleCharacterDetectorModule,
  unicodeNormalizerModule,
  smartQuoteNormalizerModule,
  csvColumnToListModule,
  findReplaceModule,
  languageStatisticsModule,
  lineDeduplicatorModule,
  lineSorterModule,
  listDifferenceModule,
  listIntersectionModule,
  markdownPreviewModule,
  markdownTableModule,
  sampleDataModule,
  slugModule,
  textToCsvModule,
  textDiffModule,
  semanticTextChunkerModule,
  factSensitiveTextDiffModule,
  stablePlaceholderAnonymizerModule,
  italianGulpeaseReadabilityModule,
  mojibakeRepairModule,
  pdfCopyTextReflowModule,
  phoneLinkHashtagMentionExtractorModule,
];

describe("text-writing engine", () => {
  it("reports explicit Unicode-aware text counts", () => {
    expect(inspectText({ text: "Café 👩‍💻\r\nline two" })).toMatchObject({
      words: 3,
      characters: 18,
      codePoints: 18,
      lines: 2,
      paragraphs: 1,
      bytes: 27,
    });
    expect(inspectText({ text: "e\u0301" })).toMatchObject({ codePoints: 2, graphemeClusters: 1 });
    expect(inspectText({ text: "" })).toMatchObject({ words: 0, lines: 0, paragraphs: 0 });
  });

  it("estimates reading time and converts case and whitespace deterministically", () => {
    expect(estimateReadingTime({ text: "one two three four", wordsPerMinute: 120 })).toMatchObject({ words: 4, wordsPerMinute: 120, minutes: 1, seconds: 2 });
    expect(convertTextCase({ text: "hello-world", mode: "camel" })).toMatchObject({ output: "helloWorld", changed: true });
    expect(convertTextCase({ text: "hello world", mode: "constant" }).output).toBe("HELLO_WORLD");
    expect(normalizeWhitespace({ text: "  alpha\t beta \r\n gamma\u00a0 delta  " }).output).toBe("alpha beta\ngamma delta");
  });

  it("detects and normalizes invisible, Unicode, and quote characters", () => {
    expect(findInvisibleCharacters({ text: "a\u200Bb\ufeff" }).characters).toEqual([
      { codePoint: "U+200B", offset: 1, index: 0, name: "ZERO WIDTH SPACE", character: "\u200B" },
      { codePoint: "U+FEFF", offset: 3, index: 1, name: "ZERO WIDTH NO-BREAK SPACE", character: "\ufeff" },
    ]);
    expect(normalizeUnicode({ text: "e\u0301", form: "NFC" }).output).toBe("é");
    expect(normalizeQuotes({ text: "\"It's fine\"" }).output).toBe("“It’s fine”");
    expect(normalizeQuotes({ text: "“It’s fine”", direction: "curly-to-straight" }).output).toBe("\"It's fine\"");
  });

  it("keeps list operations stable and explicit", () => {
    expect(sortLines({ text: "b\nA\na", caseSensitive: false }).lines).toEqual(["A", "a", "b"]);
    expect(sortLines({ lines: ["b", "a", "A"] }).lines).toEqual(["A", "a", "b"]);
    expect(deduplicateLines({ text: "é\ne\u0301\ntea", equality: "nfc" })).toMatchObject({ lines: ["é", "tea"], removedCount: 1 });
    expect(intersectLists({ left: "a\nb\nb", right: "b\nc", equality: "exact" })).toMatchObject({ intersection: ["b"], count: 1 });
    expect(intersectLists({ left: ["a", "b"], right: ["b"] })).toMatchObject({ intersection: ["b"] });
    expect(differenceLists({ left: "a\nb", right: "b", equality: "exact" })).toMatchObject({ difference: ["a"], count: 1 });
  });

  it("previews literal and regular-expression replacements", () => {
    expect(previewFindReplace({ text: "one one", find: "one", replace: "two" })).toMatchObject({ output: "two two", matchCount: 2 });
    expect(previewFindReplace({ text: "one one", find: "one", replace: "two", all: false })).toMatchObject({ output: "two one", matchCount: 1 });
    expect(previewFindReplace({ text: "a1 b2", find: "[a-z](\\d)", replace: "$1$1", regex: true })).toMatchObject({ output: "11 22", matchCount: 2 });
    expect(previewFindReplace({ text: "a1 b2", find: "[a-z](\\d)", replace: "$1$1", regex: true, all: false })).toMatchObject({ output: "11 b2", matchCount: 1 });
    expect(() => previewFindReplace({ text: "x", find: "(", replace: "y", regex: true })).toThrow("INVALID_REGEX");
  });

  it("renders Markdown without trusting raw HTML or unsafe links", () => {
    const result = renderMarkdown({ text: "# Hello\n\n**safe** <script>alert(1)</script>\n\n[x](javascript:alert(1))" });
    expect(result.html).toContain("<h1>Hello</h1>");
    expect(result.html).toContain("<strong>safe</strong>");
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("href=\"#\"");
    const active = renderMarkdown({ text: '<img src=x onerror=alert(1)>\n\n<svg><a xlink:href="javascript:alert(1)">x</a></svg>' });
    expect(active.html).toContain("&lt;img");
    expect(active.html).toContain("&lt;svg");
    expect(active.html).not.toContain("<img");
    expect(active.html).not.toContain("<svg");
  });

  it("formats Markdown tables and round-trips quoted CSV rows", () => {
    expect(formatMarkdownTable({ text: "|a|b|\n|-|-|\n|one|two|" }).output).toBe("| a   | b   |\n| --- | --- |\n| one | two |");
    const csv = textToCsv({ text: "one,\"two, values\"\nthree,\"say \"\"hi\"\"\"" }).csv;
    expect(csv).toBe("column1,column2\none,\"two, values\"\nthree,\"say \"\"hi\"\"\"");
    expect(csvColumnToList({ csv: "name,note\nAda,\"hello, world\"", column: "note" })).toMatchObject({ values: ["hello, world"], list: "hello, world", column: "note" });
  });

  it("neutralizes spreadsheet formulas in generated CSV and rejects risky replacement regexes", () => {
    expect(textToCsv({ text: "=1+1\n@SUM(1,1)\n+1\n-1+1" }).csv).toContain("'=1+1");
    expect(() => previewFindReplace({ text: "a", find: "(a+)+", replace: "x", regex: true })).toThrow(/REGEX_COMPLEXITY/u);
  });

  it("creates bounded slugs, deterministic samples, and heuristic language statistics", () => {
    expect(generateSlug({ text: "  Café déjà vu / notes ", maxLength: 12 }).slug).toBe("cafe-deja-vu");
    expect(generateSampleData({ type: "words", count: 4, seed: 7 })).toEqual(generateSampleData({ type: "words", count: 4, seed: 7 }));
    expect(languageStatistics({ text: "Hello world. Привет мир." })).toMatchObject({ language: "en", dominantScript: "Latin", confidence: "heuristic" });
  });
});

describe("text-writing tool modules", () => {
  it("executes each shared-family module through its public run seam", () => {
    expect(wordCharacterLineCounterModule.run({ text: "A" }, { defaults: {} })).toMatchObject({ words: 1 });
    expect(readingTimeEstimatorModule.run({ text: "one two" }, { defaults: {} })).toMatchObject({ words: 2 });
    expect(caseConverterModule.run({ text: "A", mode: "lower" }, { defaults: {} })).toMatchObject({ output: "a" });
    expect(whitespaceNormalizerModule.run({ text: " a  b " }, { defaults: {} })).toMatchObject({ output: "a b" });
    expect(invisibleCharacterDetectorModule.run({ text: "a\u200bb" }, { defaults: {} })).toMatchObject({ count: 1 });
    expect(unicodeNormalizerModule.run({ text: "e\u0301", form: "NFC" }, { defaults: {} })).toMatchObject({ output: "é" });
    expect(smartQuoteNormalizerModule.run({ text: "\"x\"" }, { defaults: {} })).toMatchObject({ output: "“x”" });
    expect(lineSorterModule.run({ text: "b\na" }, { defaults: {} })).toMatchObject({ lines: ["a", "b"] });
    expect(lineDeduplicatorModule.run({ text: "a\na" }, { defaults: {} })).toMatchObject({ keptCount: 1 });
    expect(listIntersectionModule.run({ left: "a", right: "a" }, { defaults: {} })).toMatchObject({ count: 1 });
    expect(listDifferenceModule.run({ left: "a", right: "a" }, { defaults: {} })).toMatchObject({ count: 0 });
    expect(findReplaceModule.run({ text: "a", find: "a", replace: "b" }, { defaults: {} })).toMatchObject({ output: "b" });
    expect(markdownPreviewModule.run({ markdown: "# Safe" }, { defaults: {} })).toMatchObject({ escapedRawHtml: false });
    expect(markdownTableModule.run({ markdown: "|a|\n|-|\n|b|" }, { defaults: {} })).toMatchObject({ table: { headers: ["a"], rows: [["b"]] } });
    expect(slugModule.run({ text: "A title" }, { defaults: {} })).toMatchObject({ slug: "a-title" });
    expect(textToCsvModule.run({ text: "a,b" }, { defaults: {} })).toMatchObject({ rowCount: 1 });
    expect(csvColumnToListModule.run({ csv: "a\nb", column: 0 }, { defaults: {} })).toMatchObject({ values: ["b"] });
    expect(sampleDataModule.run({ type: "numbers", count: 2, seed: 1 }, { defaults: {} })).toMatchObject({ count: 2 });
    expect(languageStatisticsModule.run({ text: "Hello" }, { defaults: {} })).toMatchObject({ words: 1 });
    expect(textDiffModule.run({ before: "a", after: "b" }, { defaults: {} })).toMatchObject({ additions: 1, removals: 1 });
    expect(semanticTextChunkerModule.run({ text: "A sentence. Another sentence.", targetCharacters: 32 }, { defaults: {} })).toMatchObject({ exactRoundTrip: true });
    expect(factSensitiveTextDiffModule.run({ before: "42", after: "43" }, { defaults: {} })).toMatchObject({ sensitiveChangeCount: 2 });
    const anonymized = stablePlaceholderAnonymizerModule.run({ text: "Mario", mode: "anonymize", entities: ["Mario"] }, { defaults: {} }) as { output: string; mapping: unknown[] };
    expect(anonymized.mapping).toHaveLength(1);
    expect(italianGulpeaseReadabilityModule.run({ text: "Il gatto corre." }, { defaults: {} })).toMatchObject({ words: 3, sentences: 1 });
    expect(mojibakeRepairModule.run({ text: "CafÃ¨" }, { defaults: {} })).toMatchObject({ output: "Cafè", accepted: true });
    expect(pdfCopyTextReflowModule.run({ text: "prima riga\ncontinua." }, { defaults: {} })).toMatchObject({ output: "prima riga continua." });
    expect(phoneLinkHashtagMentionExtractorModule.run({ text: "#ciao" }, { defaults: {} })).toMatchObject({ count: 1 });
  });

  it("rejects cancelled work at the shared module seam", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => caseConverterModule.run({ text: "a" }, { defaults: {} }, controller.signal)).toThrow("Operation cancelled");
  });

  it("keeps module count aligned with the implemented family", () => {
    expect(modules).toHaveLength(27);
  });
});
