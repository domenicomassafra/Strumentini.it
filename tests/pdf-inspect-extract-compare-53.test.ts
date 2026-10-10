import { describe, it, expect } from "vitest";
import { createSimplePdf } from "../src/engines/pdf/writer";
import { exportScopedPdfText53 } from "../src/engines/pdf/text-export-53";
import { visualLines53 } from "../src/engines/pdf/text-layout-53";
import { inspectPdfBytes } from "../src/engines/pdf";
import { readFile } from "node:fs/promises";

describe("#53 visual-line extraction + actual downloadable TXT/MD subset", () => {
  it("orders nonsemantic operator fragments using actual PDF geometry, not content order", () => {
    const outOfOrder = [
      { str: "LOW", transform: [12, 0, 0, 12, 80, 20], width: 40 },
      { str: "RIGHT", transform: [12, 0, 0, 12, 100, 100], width: 60 },
      { str: "TOP", transform: [12, 0, 0, 12, 20, 100], width: 36 },
    ];
    expect(visualLines53(outOfOrder)).toBe("TOP RIGHT\nLOW");
    expect(() => visualLines53([{ str: "ROTATED", transform: [0, 1, -1, 0, 50, 50], width: 50 }])).toThrow(/PDF53_LAYOUT_UNSUPPORTED/u);
    expect(() => visualLines53([{ str: "INVALID", transform: [12, 0, 0, 12, Number.NaN, 5], width: 40 }])).toThrow(/PDF53_LAYOUT_UNSUPPORTED/u);
  });

  it("PDF.js reopens real 3-page PDF, extracts selected pages in chosen order and verifies UTF-8 bytes", async () => {
    const source = createSimplePdf(["PAGE53_ALPHA", "PAGE53_BETA", "PAGE53_GAMMA"]);
    const exported = await exportScopedPdfText53(source, { sourceName: "fattura firmata.pdf", pages: [3, 1], mode: "visual-lines" });
    expect(exported.pages).toEqual([3, 1]);
    expect(exported.mode).toBe("visual-lines");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(exported.text.bytes);
    expect(text).toContain("===== PAGINA 3 =====\n\nPAGE53_GAMMA");
    expect(text).toContain("===== PAGINA 1 =====\n\nPAGE53_ALPHA");
    expect(text).not.toContain("PAGE53_BETA");
    const markdown = new TextDecoder("utf-8", { fatal: true }).decode(exported.markdown.bytes);
    expect(markdown).toContain("## Pagina 3\n\n```text\nPAGE53_GAMMA\n```");
    expect(exported.text.filename).toBe("fattura-firmata.txt");
    expect(exported.markdown.filename).toBe("fattura-firmata.md");
    await expect(exportScopedPdfText53(source, { sourceName: "x.pdf", pages: [1, 1], mode: "visual-lines" })).rejects.toThrow(/PAGE_SELECTION_INVALID/u);
    const abort = new AbortController(); abort.abort();
    await expect(exportScopedPdfText53(source, { sourceName: "x.pdf", mode: "visual-lines" }, abort.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("link inspection retains actual page and object provenance for independently saved annotation", async () => {
    const fixture = new Uint8Array(await readFile(new URL("../quality/fixtures/pdf-gold/annotated.pdf", import.meta.url)));
    const inspection = inspectPdfBytes(fixture);
    expect(inspection.links).toHaveLength(1);
    expect(inspection.links[0]).toMatchObject({ page: 1, source: "annotation", uri: "https://example.test/a" });
    expect(inspection.links[0]?.objectId).toBeGreaterThan(0);
    const page1 = inspection.pages[0];
    expect(page1?.annotationCount).toBeGreaterThan(0);
  });

  it("metadata keeps Info object identity and independent XMP object provenance", async () => {
    const fixture = new Uint8Array(await readFile(new URL("../quality/fixtures/pdf-gold/page-scoped-images-metadata.pdf", import.meta.url)));
    const inspection = inspectPdfBytes(fixture);
    expect(inspection.metadata.infoObjectId).toBeGreaterThan(0);
    expect(inspection.metadata.xmpObjectIds).toEqual([9]);
    expect(inspection.metadata.entries.some((entry) => entry.source === "document-info" && entry.key === "Title")).toBe(true);
  });
});
