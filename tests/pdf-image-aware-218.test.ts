import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { recompressPdfEmbeddedJpegs } from "../src/engines/pdf/jpeg-image-aware";
import { pdfArray, pdfDict, pdfName, pdfNumber, pdfReference } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";

const WIDTH = 320;
const HEIGHT = 240;

function rgbFixture(): Uint8Array {
  const output = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 3;
      output[offset] = (x * 7 + y * 3 + (x ^ y) * 11) % 256;
      output[offset + 1] = (x * 11 + y * 13 + (x ^ (y * 3)) * 5) % 256;
      output[offset + 2] = (x * 17 + y * 5 + ((x + y) % 17) * 9) % 256;
    }
  }
  return output;
}

function pdfWithVectorAndJpeg(jpeg: Uint8Array, options: { protectedMask?: boolean; filter?: string } = {}): Uint8Array {
  const pdf = new PdfBuilder();
  const root = pdf.reserve();
  const pages = pdf.reserve();
  const page = pdf.reserve();
  const font = pdf.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const image = pdf.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(WIDTH), Height: pdfNumber(HEIGHT),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName(options.filter ?? "DCTDecode"),
    ...(options.protectedMask ? { Mask: pdfArray([pdfNumber(0), pdfNumber(0)]) } : {}),
  }), bytes: jpeg });
  const content = pdf.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(
    "q 320 0 0 240 0 0 cm /Im0 Do Q\nBT /F1 18 Tf 12 260 Td (VECTOR-TEXT-ALIVE) Tj ET\n") });
  pdf.put(page, pdfDict({ Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(320), pdfNumber(300)]),
    Resources: pdfDict({ Font: pdfDict({ F1: font }), XObject: pdfDict({ Im0: image }) }), Contents: content }));
  pdf.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  pdf.put(root, pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return pdf.build(root, null);
}

/** Real JPEG bytes from libvips; browser API shim only replaces image decoding/encoding. */
function installImageCodec(): void {
  vi.stubGlobal("createImageBitmap", async (blob: Blob) => {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data, close() {} };
  });
  vi.stubGlobal("document", {
    createElement: (kind: string) => {
      if (kind !== "canvas") throw new Error("Expected canvas");
      let image: { data: Buffer; width: number; height: number } | null = null;
      return {
        width: 0, height: 0,
        getContext: () => ({ drawImage: (bitmap: typeof image) => { image = bitmap; } }),
        toBlob(callback: (blob: Blob | null) => void, mime: string, quality: number) {
          if (image === null || mime !== "image/jpeg") throw new Error("Codec was given wrong image/MIME");
          const input = image;
          void sharp(input.data, { raw: { width: input.width, height: input.height, channels: 3 } })
            .jpeg({ quality: Math.round(quality * 100) }).toBuffer()
            .then((bytes) => callback(new Blob([Uint8Array.from(bytes)], { type: "image/jpeg" })), () => callback(null));
        },
      };
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("218 — real bounded JPEG Image XObject recompression and source safety", () => {
  it("writes a smaller parseable PDF with a re-encoded JPEG while retaining vector/text bytes", async () => {
    installImageCodec();
    const rgb = rgbFixture();
    const originalJpeg = new Uint8Array(await sharp(rgb, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).jpeg({ quality: 100 }).toBuffer());
    const source = pdfWithVectorAndJpeg(originalJpeg);
    const originalCopy = source.slice();
    const result = await recompressPdfEmbeddedJpegs(source, { quality: 0.48 });
    expect(result.artifact.bytes.byteLength).toBeLessThan(source.byteLength);
    expect(result.analysis).toMatchObject({ touched: 1, skipped: 0, downsampleApplied: false,
      grayscaleApplied: false, pngOrJbig2Applied: false, extractedTextStable: true, pageGeometryStable: true });
    expect(result.analysis.inventory[0]).toMatchObject({ action: "recompressed", width: WIDTH, height: HEIGHT });
    expect(source).toEqual(originalCopy);
    const before = inspectPdfBytes(source);
    const after = inspectPdfBytes(result.artifact.bytes);
    expect(after.images[0]?.byteLength).toBeLessThan(before.images[0]?.byteLength ?? 0);
    expect(after.pages[0]).toMatchObject({ width: 320, height: 300, textBytes: before.pages[0]!.textBytes });
    expect((await extractPdfText(result.artifact.bytes))[0]!.text).toContain("VECTOR-TEXT-ALIVE");
    // The JPEG is genuinely lossy, but decoded pixels remain close.
    const { parsePdf } = await import("../src/engines/pdf/parser");
    const findJpeg = (bytes: Uint8Array) => [...parsePdf(bytes).objects.values()]
      .find((object) => object.value.kind === "stream" && object.value.dictionary.entries.get("Subtype")?.kind === "name"
        && object.value.dictionary.entries.get("Subtype")?.value === "Image")!.value;
    const first = findJpeg(source);
    const second = findJpeg(result.artifact.bytes);
    if (first.kind !== "stream" || second.kind !== "stream") throw new Error("No embedded JPEG stream");
    const pixelsA = await sharp(Buffer.from(first.bytes)).removeAlpha().raw().toBuffer();
    const pixelsB = await sharp(Buffer.from(second.bytes)).removeAlpha().raw().toBuffer();
    let sum = 0;
    for (let index = 0; index < pixelsA.length; index += 1) sum += Math.abs(pixelsA[index]! - pixelsB[index]!);
    expect(sum / pixelsA.length).toBeLessThan(45);
    expect(second.bytes).not.toEqual(first.bytes);
  });

  it("skips masked or unsupported filters without modifying source content", async () => {
    installImageCodec();
    const jpeg = new Uint8Array(await sharp(rgbFixture(), { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).jpeg({ quality: 100 }).toBuffer());
    for (const options of [{ protectedMask: true }, { filter: "JPXDecode" }]) {
      const input = pdfWithVectorAndJpeg(jpeg, options);
      const result = await recompressPdfEmbeddedJpegs(input, { quality: 0.4 });
      expect(result.artifact.bytes).toEqual(input);
      expect(result.analysis).toMatchObject({ touched: 0, skipped: 1, recommendOriginal: true });
    }
  });

  it("rejects unsafe quality and aborted operations before producing output", async () => {
    const jpeg = new Uint8Array(await sharp(rgbFixture(), { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).jpeg({ quality: 100 }).toBuffer());
    const pdf = pdfWithVectorAndJpeg(jpeg);
    await expect(recompressPdfEmbeddedJpegs(pdf, { quality: 0.01 })).rejects.toThrow(/quality/u);
    const controller = new AbortController();
    controller.abort();
    await expect(recompressPdfEmbeddedJpegs(pdf, { quality: 0.5 }, controller.signal)).rejects.toThrow();
  });
});
