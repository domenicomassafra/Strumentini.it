import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  convertTextMarkup,
  type TextMarkupConversionMode,
} from "../src/engines/text-markup-conversion";
import markdownPreviewModule from "../src/tools/markdown-preview/module";
import converterModule from "../src/tools/text-markup-converter/module";

interface FixtureVector {
  readonly id: string;
  readonly mode: TextMarkupConversionMode;
  readonly input: string;
  readonly expected_output: string;
  readonly must_not_contain_preview?: readonly string[];
  readonly expected_dropped_contains?: string;
}

const fixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/text-markup-conversion/vectors.json", import.meta.url), "utf8"),
) as { readonly vectors: readonly FixtureVector[] };

describe("ticket 54 — normalized TXT/Markdown/HTML conversion core", () => {
  it("matches independent exact vectors for every required conversion direction", () => {
    expect(new Set(fixtures.vectors.map((vector) => vector.mode))).toEqual(new Set([
      "markdown-to-html",
      "html-to-markdown",
      "markdown-to-text",
      "text-to-html",
      "html-to-text",
    ]));
    for (const vector of fixtures.vectors) {
      const result = convertTextMarkup({ mode: vector.mode, text: vector.input });
      expect(result.output, vector.id).toBe(vector.expected_output);
      for (const forbidden of vector.must_not_contain_preview ?? []) {
        expect(result.previewHtml.toLowerCase(), `${vector.id} preview`).not.toContain(forbidden.toLowerCase());
      }
      if (vector.expected_dropped_contains !== undefined) {
        expect(result.droppedConstructs.some((item) => item.includes(vector.expected_dropped_contains!)), vector.id).toBe(true);
      }
    }
  });

  it("sanitizes active HTML and unsafe URLs before any preview HTML is produced", () => {
    const payload = '<svg onload="alert(1)"><script>alert(2)</script><a href="jav&#x61;script:alert(3)">x</a></svg><p onclick="alert(4)">safe</p>';
    const result = convertTextMarkup({ mode: "html-to-markdown", text: payload });
    expect(result.previewHtml).not.toMatch(/<script|onload|onclick|javascript:/iu);
    expect(result.output).not.toMatch(/javascript:|alert\(/iu);
    expect(result.output).toContain("safe");
    expect(result.droppedConstructs.some((item) => item.includes("schema non sicuro"))).toBe(true);
  });

  it("preserves whitespace inside pre/code while applying HTML whitespace collapse elsewhere", () => {
    const html = "<p>a    b\n c</p><pre>  alpha\n\tbeta  </pre>";
    const result = convertTextMarkup({ mode: "html-to-text", text: html });
    expect(result.output).toBe("a b c\n\n  alpha\n\tbeta  ");
    expect(result.previewHtml).toContain("<pre><code>  alpha\n\tbeta  </code></pre>");
  });

  it("preserves textarea RCDATA whitespace and literal markup without executing or parsing it", () => {
    const result = convertTextMarkup({ mode: "html-to-text", text: "<textarea>  a\n<b>literal</b>  </textarea>" });
    expect(result.output).toBe("  a\n<b>literal</b>  ");
    expect(result.previewHtml).toBe("<pre><code>  a\n&lt;b&gt;literal&lt;/b&gt;  </code></pre>");
    expect(result.droppedConstructs.some((item) => item.includes("textarea"))).toBe(true);
  });

  it("is stable over supported Markdown→HTML→Markdown→HTML round trips", () => {
    const markdown = "## Titolo\n\nTesto **forte** con *enfasi*, ~~rimosso~~, `x` e [link](https://example.com).\n\n- uno\n- due\n\n> citazione\n\n```\na < b\n```";
    const firstHtml = convertTextMarkup({ mode: "markdown-to-html", text: markdown }).output;
    const markdownAgain = convertTextMarkup({ mode: "html-to-markdown", text: firstHtml }).output;
    const secondHtml = convertTextMarkup({ mode: "markdown-to-html", text: markdownAgain }).output;
    expect(secondHtml).toBe(firstHtml);
  });

  it("normalizes newline encoding deterministically without normalizing Unicode composition", () => {
    const decomposed = "Cafe\u0301\r\nlinea\raltro";
    const result = convertTextMarkup({ mode: "text-to-html", text: decomposed });
    expect(result.sourceNormalized).toBe("Cafe\u0301\nlinea\naltro");
    expect(result.sourceNormalized).not.toBe(result.sourceNormalized.normalize("NFC"));
    expect(result.output).toBe("<p>Cafe\u0301<br />linea<br />altro</p>");
    expect(result.newlinePolicy).toContain("LF");
    expect(result.unicodePolicy).toContain("senza normalizzazione NFC/NFKC");
  });

  it("declares CommonMark/GFM scope and does not silently reinterpret unsupported extension syntax", () => {
    const result = convertTextMarkup({ mode: "markdown-to-html", text: "- [x] fatto\n\n| a | b |\n|---|---|\n| 1 | 2 |" });
    expect(result.dialectPolicy).toContain("CommonMark 0.31.2");
    expect(result.dialectPolicy).toContain("tabelle, task list, autolink extension e footnote GFM non sono interpretati");
    expect(result.droppedConstructs.some((item) => item.includes("GFM task list"))).toBe(true);
    expect(result.droppedConstructs.some((item) => item.includes("GFM table"))).toBe(true);
  });

  it("keeps markdown-preview compatible while routing it through the normalized core", () => {
    expect(markdownPreviewModule.run({ markdown: "# Safe" }, { defaults: {} })).toMatchObject({
      html: "<h1>Safe</h1>",
      escapedRawHtml: false,
      warnings: [],
    });
    expect(markdownPreviewModule.run({ markdown: "<script>alert(1)</script>" }, { defaults: {} })).toMatchObject({
      escapedRawHtml: true,
    });
  });

  it("exposes correct local runtime filenames, MIME types and full UTF-8 outputs", () => {
    const html = converterModule.run({ mode: "markdown-to-html", text: "# È" }, { defaults: {} }) as ReturnType<typeof convertTextMarkup>;
    expect(html).toMatchObject({ filename: "documento-convertito.html", mime: "text/html", output: "<h1>È</h1>" });
    const markdown = converterModule.run({ mode: "html-to-markdown", text: "<p>È</p>" }, { defaults: {} }) as ReturnType<typeof convertTextMarkup>;
    expect(markdown).toMatchObject({ filename: "documento-convertito.md", mime: "text/markdown", output: "È" });
    const text = converterModule.run({ mode: "html-to-text", text: "<p>È</p>" }, { defaults: {} }) as ReturnType<typeof convertTextMarkup>;
    expect(text).toMatchObject({ filename: "documento-convertito.txt", mime: "text/plain", output: "È" });
  });
});
