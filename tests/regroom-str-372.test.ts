import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { runPdfPageWorkspace372 } from "../src/engines/pdf/workspace-372";
import { runPasswordCodec417 } from "../src/engines/pdf/password-417";

async function fixture(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= pages; n++) {
    doc.addPage([300 + n, 400]).drawText(`PAGE_NUMBER_${n}`, { x: 25, y: 150, font });
  }
  return doc.save({ useObjectStreams: false });
}

async function pdfjsTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(), stopAtErrors: true, useSystemFonts: false });
  try {
    const pdf = await task.promise;
    const texts: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      texts.push((await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" "));
      page.cleanup();
    }
    return texts;
  } finally { await task.destroy(); }
}

describe("STR-372 bounded PDF page workspace", () => {
  it.each([1, 100])("reorders a %i-page PDF with independent content and geometry readback", async (count) => {
    const source = await fixture(count);
    const previous = source.slice();
    const order = Array.from({ length: count }, (_, n) => count - n);
    const artifact = await runPdfPageWorkspace372(source, order, [], "reorder", "source.pdf");
    expect(source).toEqual(previous);
    expect(artifact.pageCount).toBe(count);
    const reopened = await PDFDocument.load(artifact.bytes);
    expect(reopened.getPages().map((page) => page.getWidth())).toEqual(order.map((id) => 300 + id));
    const texts = await pdfjsTexts(artifact.bytes);
    expect(texts).toHaveLength(count);
    expect(texts[0]).toContain(`PAGE_NUMBER_${count}`);
    expect(texts.at(-1)).toContain("PAGE_NUMBER_1");
  }, 80_000);

  it("extracts only selected pages in the chosen workspace order", async () => {
    const source = await fixture(4);
    const result = await runPdfPageWorkspace372(source, [4, 2, 3, 1], [1, 4], "selected", "source.pdf");
    expect(result.pageCount).toBe(2);
    expect((await pdfjsTexts(result.bytes)).map((text) => /PAGE_NUMBER_(\d+)/.exec(text)?.[1])).toEqual(["4", "1"]);
  });

  it("refuses duplicate, omitted and invalid page orders without partial output", async () => {
    const source = await fixture(2);
    for (const order of [[1, 1], [1], [1, 3], [1, 2, 2]]) {
      await expect(runPdfPageWorkspace372(source, order, [], "reorder", "source.pdf")).rejects.toThrow();
    }
    await expect(runPdfPageWorkspace372(source, [1, 2], [], "selected", "source.pdf")).rejects.toThrow();
  });

  it("refuses malformed, genuinely encrypted AES-256 and huge files without changing the input", async () => {
    const source = await fixture(1);
    const malformed = new TextEncoder().encode("not a PDF");
    await expect(runPdfPageWorkspace372(malformed, [1], [], "reorder", "invalid.pdf")).rejects.toThrow();
    const locked = await runPasswordCodec417(source, "protect", "STR372-proof");
    const lockedCopy = locked.slice();
    await expect(runPdfPageWorkspace372(locked, [1], [], "reorder", "encrypted.pdf")).rejects.toThrow(/encrypt|password|cifrat/iu);
    expect(locked).toEqual(lockedCopy);
    await expect(runPdfPageWorkspace372(new Uint8Array(25 * 1024 * 1024 + 1), [1], [], "reorder", "large.pdf")).rejects.toThrow(/PDF_LIMIT/);
  });

  it("preserves source when already cancelled", async () => {
    const source = await fixture(1);
    const copy = source.slice();
    const controller = new AbortController();
    controller.abort();
    await expect(runPdfPageWorkspace372(source, [1], [], "reorder", "source.pdf", controller.signal)).rejects.toThrow();
    expect(source).toEqual(copy);
  });
});
