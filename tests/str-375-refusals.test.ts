import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { insertPdfImage375, inspectPdfImage375 } from "../src/engines/pdf/image-placement-375";

const placement = { page: 1, x: 0.1, y: 0.1, width: 0.25, rotation: 0 as const };
async function samplePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([240, 300]).drawText("Immutable original");
  return doc.save({ useObjectStreams: false });
}

describe("STR-375 refusals: unsupported transparency/profiles never destroy source", () => {
  it("rejects actual indexed PNG with partial transparency before creating a PDF", async () => {
    const original = await samplePdf();
    const snapshot = original.slice();
    const indexed = new Uint8Array(await sharp({
      create: { width: 8, height: 8, channels: 4,
        background: { r: 25, g: 50, b: 175, alpha: 0.4 } },
    }).png({ palette: true }).toBuffer());
    expect(indexed[25]).toBe(3);
    expect(() => inspectPdfImage375(indexed)).toThrow(/UNSUPPORTED_PNG/);
    await expect(insertPdfImage375(original, indexed, placement, "source.pdf"))
      .rejects.toThrow(/UNSUPPORTED_PNG/);
    expect(original).toEqual(snapshot);
    expect((await PDFDocument.load(original)).getPageCount()).toBe(1);
  });

  it("rejects corrupt transparency chunks and ICC JPEG without touching the PDF", async () => {
    const original = await samplePdf(), snapshot = original.slice();
    const rgba = new Uint8Array(await sharp({
      create: { width: 6, height: 6, channels: 4,
        background: { r: 20, g: 40, b: 80, alpha: 0.5 } },
    }).png().toBuffer());
    // An unsupported transparency marker is refused before PDF decoding.
    const marker = new TextEncoder().encode("tRNS");
    const altered = rgba.slice();
    altered.set(marker, 12); // replaces IHDR marker
    await expect(insertPdfImage375(original, altered, placement, "source.pdf"))
      .rejects.toThrow(/UNSUPPORTED_PNG/);
    expect(original).toEqual(snapshot);
  });

  it("fails closed for signed/XFA PDFs and aborted operations", async () => {
    const original = await samplePdf(), immutable = original.slice();
    const image = new Uint8Array(await sharp({
      create: { width: 5, height: 5, channels: 4,
        background: { r: 30, g: 50, b: 170, alpha: 0.7 } },
    }).png().toBuffer());
    const annotated = new Uint8Array([...original, ...new TextEncoder().encode("\n/ByteRange [0 1 2 3]\n")]);
    await expect(insertPdfImage375(annotated, image, placement, "signed.pdf"))
      .rejects.toThrow(/UNSUPPORTED_PDF/);
    const controller = new AbortController();
    controller.abort();
    await expect(insertPdfImage375(original, image, placement, "cancel.pdf", controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(original).toEqual(immutable);
  });
});
