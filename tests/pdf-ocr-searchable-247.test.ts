import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { addInvisibleOcrLayer247, type OcrPage247 } from "../src/engines/pdf/ocr-searchable-247";
import { nameValue, parsePdf } from "../src/engines/pdf/parser";
import { buildPdfFromJpegs, buildPdfFromPages, createSimplePdf, parseJpeg } from "../src/engines/pdf/writer";

const scan: OcrPage247 = {
  page: 1, imageWidth: 1280, imageHeight: 240,
  words: [
    { text: "Fattura", bbox: { x0: 40, y0: 50, x1: 185, y1: 99 }, confidence: 94 },
    { text: "numero", bbox: { x0: 202, y0: 50, x1: 351, y1: 99 }, confidence: 94 },
    { text: "12345", bbox: { x0: 362, y0: 50, x1: 480, y1: 99 }, confidence: 94 },
    { text: "€", bbox: { x0: 500, y0: 50, x1: 527, y1: 99 }, confidence: 94 },
  ],
};

async function imagePdf() {
  const fixture = await readFile(resolve("spikes/heavy-local-feasibility/public/corpus/ocr-it.png"));
  const jpeg = await sharp(fixture).jpeg({ quality: 96 }).toBuffer();
  const parsed = parseJpeg(new Uint8Array(jpeg), "real-italian-scan.jpg");
  if (!parsed) throw new Error("JPEG fixture invalid");
  return buildPdfFromJpegs([parsed]);
}

describe("#247 bounded PDF text overlay, original streams and strict refusal", () => {
  it("makes the real scanned-image PDF searchable while preserving byte-identical original drawing streams", async () => {
    const sourceBytes = await imagePdf();
    const source = parsePdf(sourceBytes);
    const output = addInvisibleOcrLayer247(sourceBytes, [scan]);
    const reopened = parsePdf(output);
    expect(reopened.pages).toHaveLength(1);
    expect(reopened.pages[0]!.object.value.kind).toBe("dict");
    const originalImage = [...source.objects.values()].find((object) => object.value.kind === "stream" &&
      nameValue(object.value.dictionary.entries.get("Subtype")) === "Image");
    const newImage = [...reopened.objects.values()].find((object) => object.value.kind === "stream" &&
      nameValue(object.value.dictionary.entries.get("Subtype")) === "Image");
    expect(newImage?.value.kind).toBe("stream");
    if (newImage?.value.kind !== "stream" || originalImage?.value.kind !== "stream") throw new Error("Image absent");
    expect(newImage.value.bytes).toEqual(originalImage.value.bytes);
    const pdfjs = await import("pdfjs-dist");
    const task = pdfjs.getDocument({ data: Uint8Array.from(output), useSystemFonts: true });
    try {
      const document = await task.promise;
      const page = await document.getPage(1);
      const text = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
      expect(text).toContain("Fattura");
      expect(text).toContain("12345");
      expect(text).toContain("€");
      expect(text).not.toContain("scan.jpg");
    } finally { await task.destroy(); }
  });

  it("passes born-digital pages through unchanged while adding OCR only to scanned pages", async () => {
    const image = parsePdf(await imagePdf());
    const digital = parsePdf(createSimplePdf(["FATTURA DIGITALE PRESENTE"], { width: 1280, height: 240 }));
    const sourceBytes = buildPdfFromPages([{ document: image, page: image.pages[0]! },
      { document: digital, page: digital.pages[0]! }]);
    const result = addInvisibleOcrLayer247(sourceBytes, [scan]);
    const pdfjs = await import("pdfjs-dist");
    const task = pdfjs.getDocument({ data: Uint8Array.from(result), useSystemFonts: true });
    try {
      const document = await task.promise;
      expect(document.numPages).toBe(2);
      const texts = [];
      for (let page = 1; page <= 2; page++) {
        const item = await document.getPage(page);
        texts.push((await item.getTextContent()).items.map((part) => "str" in part ? part.str : "").join(" "));
      }
      expect(texts[0]).toContain("Fattura");
      expect(texts[1]).toContain("FATTURA DIGITALE PRESENTE");
      expect(texts[1]).not.toContain("12345");
    } finally { await task.destroy(); }
  });

  it("rejects mismatched coordinates, duplicate page placements, unsupported glyphs, and cancellation", async () => {
    const source = await imagePdf();
    expect(() => addInvisibleOcrLayer247(source, [{ ...scan, words: [
      { ...scan.words[0]!, bbox: { x0: 0, y0: 0, x1: 1281, y1: 10 } },
    ] }])).toThrow(/OCR247_INVALID_WORD_COORDINATES/u);
    expect(() => addInvisibleOcrLayer247(source, [scan, scan])).toThrow(/OCR247_INVALID_PAGE_SELECTION/u);
    expect(() => addInvisibleOcrLayer247(source, [{ ...scan, words: [{ ...scan.words[0]!, text: "漢字" }] }])).toThrow(/OCR247_UNSUPPORTED_GLYPH/u);
    const signal = new AbortController(); signal.abort();
    expect(() => addInvisibleOcrLayer247(source, [scan], signal.signal)).toThrowError(expect.objectContaining({ name: "AbortError" }));
  });
});
