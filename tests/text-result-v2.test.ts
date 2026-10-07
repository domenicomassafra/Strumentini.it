import { readFileSync } from "node:fs";
import { h } from "preact";
import render from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import {
  buildTextResultPresentation,
  createTextResultArtifact,
  TextFamilyResultV2,
} from "../src/components/tools/text-writing/TextFamilyResultV2";
import {
  differenceLists,
  findInvisibleCharacters,
  formatMarkdownTable,
  normalizeUnicode,
  normalizeWhitespace,
  sortLines,
  textToCsv,
} from "../src/engines/text-writing";
import { compareLists, diffText } from "../src/engines/text-list";
import { catalog } from "../src/generated/catalog";
import { TEXT_RESULT_V2_DECLARATIONS } from "../src/tools/text-writing/result-v2";

describe("ticket 92 Result v2 text/list contract", () => {
  it("declares every ledger-owned text/list tool with semantic classes and truthful actions", () => {
    const entries = Object.entries(TEXT_RESULT_V2_DECLARATIONS);
    const family = catalog.filter(({ engine }) => engine === "text-writing" || engine === "text-list");
    expect(entries.map(([toolId]) => toolId).toSorted()).toEqual(family.map(({ id }) => id).toSorted());
    expect(new Set(entries.map(([, declaration]) => declaration.class))).toEqual(new Set(["text-code", "table", "validator"]));
    for (const [toolId, declaration] of entries) {
      expect(family.find(({ id }) => id === toolId)?.result, toolId).toEqual(declaration);
      expect(declaration.capabilities).toContain("copy");
      expect(declaration.capabilities).toContain("download");
      expect(declaration.capabilities).toContain("reset");
    }
    expect(TEXT_RESULT_V2_DECLARATIONS["invisible-character-detector"]).toMatchObject({
      class: "validator",
      capabilities: expect.arrayContaining(["retry", "reuse", "provenance"]),
    });
  });

  it("keeps transformed Unicode/newline bytes exact for copy/download artifacts", () => {
    const whitespace = normalizeWhitespace({ text: "  Café\u00a0 noir  \r\n  e\u0301  " });
    const whitespacePresentation = buildTextResultPresentation("whitespace-normalizer", whitespace);
    const whitespaceArtifact = createTextResultArtifact(whitespacePresentation);
    expect(whitespacePresentation.fullText).toBe(whitespace.output);
    expect(new TextDecoder().decode(whitespaceArtifact.bytes)).toBe(whitespace.output);
    expect(whitespaceArtifact.download.ready).toBe(true);

    const unicode = normalizeUnicode({ text: "e\u0301", form: "NFC" });
    const unicodePresentation = buildTextResultPresentation("unicode-normalizer", unicode);
    expect(unicodePresentation.fullText).toBe("é");
    expect(new TextDecoder().decode(createTextResultArtifact(unicodePresentation).bytes)).toBe("é");

    const csv = textToCsv({ text: "uno,\"due, valori\"\ntre,quattro" });
    const csvPresentation = buildTextResultPresentation("text-to-csv-rows", csv);
    expect(csvPresentation.fullText).toBe(csv.csv);
    expect(csvPresentation.mime).toBe("text/csv");
    expect(new TextDecoder().decode(createTextResultArtifact(csvPresentation).bytes)).toBe(csv.csv);
  });

  it("bounds huge previews without truncating the complete artifact", () => {
    const source = Array.from({ length: 140 }, (_, index) => `riga-${String(140 - index).padStart(3, "0")}`).join("\n");
    const result = sortLines({ text: source });
    const presentation = buildTextResultPresentation("line-sorter", result);
    expect(presentation.fullText).toBe(result.output);
    expect(presentation.fullText.split("\n")).toHaveLength(140);

    const html = render(h(TextFamilyResultV2, { tool: "line-sorter", value: result, onReuse: () => undefined, onReset: () => undefined }));
    expect(html).toContain("Anteprima: 80 di 140 righe");
    expect(html).toContain('data-result-action="copy"');
    expect(html).toContain('data-result-action="download"');
    expect(html).toContain('data-result-action="reuse"');
  });

  it("renders zero-output transforms and validator findings semantically rather than as raw JSON", () => {
    const difference = differenceLists({ left: "a", right: "a" });
    const empty = buildTextResultPresentation("list-difference", difference);
    expect(empty.fullText).toBe("");
    const emptyHtml = render(h(TextFamilyResultV2, { tool: "list-difference", value: difference, onReuse: () => undefined, onReset: () => undefined }));
    expect(emptyHtml).toContain("0 elementi");
    expect(emptyHtml).toContain('data-result-action="copy"');

    const invisible = findInvisibleCharacters({ text: "a\u200Bb" });
    const validator = buildTextResultPresentation("invisible-character-detector", invisible);
    expect(validator.headline).toContain("caratter");
    expect(validator.table?.headers).toEqual(["Codice", "Nome", "Offset"]);
    const validatorHtml = render(h(TextFamilyResultV2, { tool: "invisible-character-detector", value: invisible, onReuse: () => undefined, onRetry: () => undefined, onReset: () => undefined }));
    expect(validatorHtml).toContain("U+200B");
    expect(validatorHtml).toContain('data-result-action="retry"');
    expect(validatorHtml).not.toContain("engineVersion");
  });

  it("uses bounded table semantics for tables, list compare, and text diff", () => {
    const markdown = formatMarkdownTable({ text: "|a|b|\n|-|-|\n|uno|due|" });
    expect(buildTextResultPresentation("markdown-table-formatter", markdown).table).toEqual({
      headers: ["a", "b"],
      rows: [["uno", "due"]],
    });

    const compared = compareLists(["a", "b"], ["b", "c"], "exact");
    const listValue = { ...compared, engineVersion: "text-list-v1" };
    const listHtml = render(h(TextFamilyResultV2, { tool: "list-compare", value: listValue, onReset: () => undefined }));
    expect(listHtml).toContain("In entrambe");
    expect(listHtml).toContain("Solo in A");
    expect(listHtml).toContain('aria-label="Anteprima tabella"');

    const operations = diffText("a\nb\n", "a\nc\n");
    const diffValue = {
      operations,
      additions: operations.filter(({ kind }) => kind === "add").length,
      removals: operations.filter(({ kind }) => kind === "remove").length,
      unchanged: operations.filter(({ kind }) => kind === "equal").length,
      engineVersion: "text-list-v1",
    };
    const diffHtml = render(h(TextFamilyResultV2, { tool: "text-diff", value: diffValue, onReset: () => undefined }));
    expect(diffHtml).toContain("Rimossa");
    expect(diffHtml).toContain("Aggiunta");
    expect(diffHtml).toContain("Stato");
  });

  it("removes the family legacy-primary renderer patterns", () => {
    const textWriting = readFileSync(new URL("../src/components/tools/text-writing/TextWritingTool.tsx", import.meta.url), "utf8");
    const listCompare = readFileSync(new URL("../src/components/tools/ListCompareTool.tsx", import.meta.url), "utf8");
    expect(textWriting).not.toContain("JSON.stringify(");
    expect(textWriting).not.toContain('class="text-result"');
    expect(listCompare).not.toContain('class="result-panel gutter"');
    expect(textWriting).toContain("TextFamilyResultV2");
    expect(listCompare).toContain("TextFamilyResultV2");
  });
});
