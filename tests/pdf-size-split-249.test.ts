import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { PdfSinglePageLimit249, splitPdfBySize249 } from "../src/engines/pdf/size-split-249";

const source = Uint8Array.from(readFileSync(new URL("../quality/fixtures/pdf-gold/simple-3page.pdf", import.meta.url)));

describe("#249 exact final-byte PDF splitting, not predicted page-size shares", () => {
  it("packs contiguous pages by measured rebuilt part size and preserves every original page's text", async () => {
    const original = source.slice();
    const result = splitPdfBySize249(source, 1024);
    expect(result.allSourcePagesCovered).toBe(true);
    expect(result.parts.length).toBeGreaterThan(1);
    expect(result.parts.flatMap((part) => part.pages)).toEqual([1, 2, 3]);
    const originalText = (await extractPdfText(source)).map((page) => page.text);
    const rebuilt: string[] = [];
    for (const [index, part] of result.parts.entries()) {
      const artifact = result.artifacts[index]!;
      expect(part.bytes).toBe(artifact.bytes.length);
      expect(part.bytes).toBeLessThanOrEqual(1024);
      expect(part.filename).toMatch(/^pdf-part-\d{3}-pages-\d+-\d+\.pdf$/u);
      expect(inspectPdfBytes(artifact.bytes).pageCount).toBe(part.pages.length);
      rebuilt.push(...(await extractPdfText(artifact.bytes)).map((page) => page.text));
    }
    expect(rebuilt).toEqual(originalText);
    expect(source).toEqual(original);
  });

  it("refuses impossible single large image content with exact required byte count and page index", () => {
    const sample = new Uint8Array(readFileSync(new URL("./fixtures/pdf-image-mixed-218/safe-mixed-218.pdf", import.meta.url)));
    expect(() => splitPdfBySize249(sample, 1024)).toThrow(PdfSinglePageLimit249);
    try {
      splitPdfBySize249(sample, 1024);
    } catch (error) {
      const refusal = error as PdfSinglePageLimit249;
      expect(refusal.code).toBe("PDF_SINGLE_PAGE_TOO_LARGE");
      expect(refusal.page).toBe(1);
      expect(refusal.minimumBytes).toBeGreaterThan(refusal.targetBytes);
    }
  });

  it("rejects non-integer limits, impossible requests and pre-aborted execution", () => {
    expect(() => splitPdfBySize249(source, 512)).toThrow(/INVALID_INPUT/u);
    expect(() => splitPdfBySize249(source, 1024.2)).toThrow(/INVALID_INPUT/u);
    const controller = new AbortController(); controller.abort();
    expect(() => splitPdfBySize249(source, 1024, controller.signal)).toThrow(/cancelled/u);
  });
});
