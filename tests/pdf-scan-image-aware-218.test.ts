import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { recompressPdfScannedImages } from "../src/engines/pdf/scan-image-aware";
import { nameValue, parsePdf, pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";

const WIDTH = 480;
const HEIGHT = 360;

function rawRaster(): Uint8Array {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    const p = (y * WIDTH + x) * 3;
    pixels[p] = (x * 7 + y * 11 + (x ^ y) * 3) % 256;
    pixels[p + 1] = (x * 11 + y * 2 + (x ^ (y * 3)) * 7) % 256;
    pixels[p + 2] = (x * 3 + y * 9 + (x * y % 17) * 11) % 256;
  }
  return pixels;
}

function pngSubPredictor(raw: Uint8Array): Uint8Array {
  const rowSize = WIDTH * 3;
  const encoded = new Uint8Array(HEIGHT * (rowSize + 1));
  for (let y = 0; y < HEIGHT; y += 1) {
    encoded[y * (rowSize + 1)] = 1;
    for (let x = 0; x < rowSize; x += 1) {
      const offset = y * rowSize + x;
      encoded[y * (rowSize + 1) + 1 + x] = (raw[offset]! - (x >= 3 ? raw[offset - 3]! : 0)) & 255;
    }
  }
  return encoded;
}

function pdfWithScan(raw: Uint8Array, options: { predictor?: number; mask?: boolean; filter?: string; width?: number; height?: number; color?: "DeviceRGB" | "DeviceGray"; secondMasked?: boolean } = {}): Uint8Array {
  const width = options.width ?? WIDTH;
  const height = options.height ?? HEIGHT;
  const builder = new PdfBuilder();
  const root = builder.reserve(), pages = builder.reserve(), page = builder.reserve();
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(width), Height: pdfNumber(height),
    ColorSpace: pdfName(options.color ?? "DeviceRGB"), BitsPerComponent: pdfNumber(8),
    Filter: pdfName(options.filter ?? "FlateDecode"),
    ...(options.predictor === undefined ? {} : { DecodeParms: pdfDict({ Predictor: pdfNumber(options.predictor), Colors: pdfNumber(options.color === "DeviceGray" ? 1 : 3), Columns: pdfNumber(width), BitsPerComponent: pdfNumber(8) }) }),
    ...(options.mask ? { SMask: pdfName("ProtectedMask") } : {}),
  }), bytes: new Uint8Array(deflateSync(raw)) });
  const masked = options.secondMasked ? builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(width), Height: pdfNumber(height),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
    SMask: pdfName("ProtectedMask"),
  }), bytes: new Uint8Array(deflateSync(raw)) }) : null;
  const contents = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(
    "q 480 0 0 360 0 0 cm /Im0 Do Q\nBT /F1 18 Tf 12 375 Td (VECTOR-TEXT-ALIVE) Tj ET\n") });
  builder.put(page, pdfDict({ Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(480), pdfNumber(400)]),
    Resources: pdfDict({ Font: pdfDict({ F1: font }), XObject: pdfDict({ Im0: image, ...(masked ? { Im1: masked } : {}) }) }), Contents: contents }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  builder.put(root, pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return builder.build(root, null);
}

/** Native codec in this fixture is libvips: mocks only Canvas mechanics, never output JPEG bytes. */
function installCanvas(): void {
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error("Expected canvas");
      const canvas: { width: number; height: number; pixels?: Uint8ClampedArray; getContext?: () => unknown; toBlob?: unknown } = { width: 0, height: 0 };
      canvas.getContext = () => ({
        createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData: (frame: { data: Uint8ClampedArray }) => { canvas.pixels = frame.data.slice(); },
        drawImage: (source: { width: number; height: number; pixels: Uint8ClampedArray }, _x: number, _y: number, width: number, height: number) => {
          const resized = new Uint8ClampedArray(width * height * 4);
          for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
            const src = (Math.floor(y * source.height / height) * source.width + Math.floor(x * source.width / width)) * 4;
            resized.set(source.pixels.slice(src, src + 4), (y * width + x) * 4);
          }
          canvas.pixels = resized;
        },
      });
      canvas.toBlob = (callback: (blob: Blob | null) => void, mime: string, quality: number) => {
        if (mime !== "image/jpeg" || canvas.pixels === undefined) throw new Error("Canvas not drawn");
        const pixels = new Uint8Array(canvas.width * canvas.height * 3);
        for (let i = 0; i < canvas.width * canvas.height; i += 1) {
          pixels.set(canvas.pixels.slice(i * 4, i * 4 + 3), i * 3);
        }
        void sharp(pixels, { raw: { width: canvas.width, height: canvas.height, channels: 3 } })
          .jpeg({ quality: Math.round(quality * 100) }).toBuffer()
          .then((bytes) => callback(new Blob([Uint8Array.from(bytes)], { type: "image/jpeg" })), () => callback(null));
      };
      return canvas;
    },
  });
}

function firstImage(bytes: Uint8Array) {
  const image = [...parsePdf(bytes).objects.values()].find((object) =>
    object.value.kind === "stream" && nameValue(object.value.dictionary.entries.get("Subtype")) === "Image")?.value;
  if (image?.kind !== "stream") throw new Error("Expected embedded Image XObject");
  return image;
}

afterEach(() => vi.unstubAllGlobals());

describe("#218 scan-mode real Flate-to-JPEG profiles", () => {
  it("converts actual RGB Flate scan with PNG Sub row predictor, downsamples and keeps vector page bytes/text", async () => {
    installCanvas();
    const source = pdfWithScan(pngSubPredictor(rawRaster()), { predictor: 15 });
    const copy = source.slice();
    const output = await recompressPdfScannedImages(source, { quality: 0.45, maxLongestEdgePx: 256 });
    expect(output.artifact.bytes.length).toBeLessThan(source.length);
    expect(output.analysis).toMatchObject({ touched: 1, skipped: 0, downsampleApplied: true,
      grayscaleApplied: false, pageGeometryStable: true, extractedTextStable: true, recommendOriginal: false });
    expect(output.analysis.inventory[0]).toMatchObject({ action: "recompressed", width: WIDTH,
      height: HEIGHT, outputWidth: 256, outputHeight: 192 });
    expect(source).toEqual(copy);
    expect(inspectPdfBytes(output.artifact.bytes).pages[0]).toMatchObject({
      width: inspectPdfBytes(source).pages[0]?.width, height: inspectPdfBytes(source).pages[0]?.height,
    });
    expect((await extractPdfText(output.artifact.bytes))[0]?.text).toContain("VECTOR-TEXT-ALIVE");
    const jpeg = firstImage(output.artifact.bytes);
    expect(nameValue(jpeg.dictionary.entries.get("Filter"))).toBe("DCTDecode");
    const decoded = await sharp(Buffer.from(jpeg.bytes)).metadata();
    expect([decoded.width, decoded.height]).toEqual([256, 192]);
  });

  it("converts RGB Flate into visibly grayscale JPEG only when explicitly requested", async () => {
    installCanvas();
    const source = pdfWithScan(rawRaster());
    const output = await recompressPdfScannedImages(source, { grayscale: true, maxLongestEdgePx: 1024 });
    expect(output.analysis).toMatchObject({ touched: 1, grayscaleRequested: true,
      grayscaleApplied: true, downsampleApplied: false });
    const jpeg = firstImage(output.artifact.bytes);
    const decoded = await sharp(Buffer.from(jpeg.bytes)).raw().toBuffer({ resolveWithObject: true });
    let totalDiff = 0;
    for (let i = 0; i < decoded.info.width * decoded.info.height; i += 1) {
      const index = i * decoded.info.channels;
      totalDiff += Math.abs(decoded.data[index]! - decoded.data[index + 1]!);
      totalDiff += Math.abs(decoded.data[index]! - decoded.data[index + 2]!);
    }
    expect(totalDiff / (decoded.info.width * decoded.info.height)).toBeLessThan(3);
  });

  it("supports 8-bit DeviceGray raw scans and counts untouched masked images in a mixed PDF", async () => {
    installCanvas();
    const pixels = new Uint8Array(WIDTH * HEIGHT);
    let seed = 0x12345678;
    for (let i = 0; i < pixels.length; i += 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      pixels[i] = seed & 255;
    }
    const grayPdf = pdfWithScan(pixels, { color: "DeviceGray" });
    const grayResult = await recompressPdfScannedImages(grayPdf, { maxLongestEdgePx: 480 });
    expect(grayResult.analysis).toMatchObject({ touched: 1, skipped: 0, grayscaleApplied: false });
    expect(nameValue(firstImage(grayResult.artifact.bytes).dictionary.entries.get("ColorSpace"))).toBe("DeviceRGB");
    const mixedPdf = pdfWithScan(rawRaster(), { secondMasked: true });
    const mixed = await recompressPdfScannedImages(mixedPdf, { maxLongestEdgePx: 320 });
    expect(mixed.analysis).toMatchObject({ touched: 1, skipped: 1, candidates: 2 });
    expect(mixed.analysis.inventory.map(({ action }) => action).sort()).toEqual(["recompressed", "unchanged"]);
    expect(mixed.analysis.inventory.find(({ action }) => action === "unchanged")?.reason).toBe("complex-image-dictionary");
    expect((await extractPdfText(mixed.artifact.bytes))[0]?.text).toContain("VECTOR-TEXT-ALIVE");
  });

  it("skips masked scans, unsupported filter and compressed uniform image that would grow", async () => {
    installCanvas();
    for (const settings of [{ mask: true }, { filter: "JBIG2Decode" }, { predictor: 99 }]) {
      const source = pdfWithScan(rawRaster(), settings);
      const output = await recompressPdfScannedImages(source);
      expect(output.artifact.bytes).toEqual(source);
      expect(output.analysis).toMatchObject({ touched: 0, skipped: 1, recommendOriginal: true });
    }
    const source = pdfWithScan(new Uint8Array(WIDTH * HEIGHT * 3));
    const output = await recompressPdfScannedImages(source);
    expect(output.artifact.bytes).toEqual(source);
    expect(output.analysis).toMatchObject({ touched: 0, skipped: 1, recommendOriginal: true });
    expect(output.analysis.inventory[0]?.reason).toBe("scan-jpeg-not-meaningfully-smaller");
  });

  it("rejects unsafe options and cancellation", async () => {
    const source = pdfWithScan(rawRaster());
    await expect(recompressPdfScannedImages(source, { maxLongestEdgePx: 40 })).rejects.toThrow(/INVALID_INPUT/u);
    await expect(recompressPdfScannedImages(source, { quality: 0.1 })).rejects.toThrow(/INVALID_INPUT/u);
    const controller = new AbortController();
    controller.abort();
    await expect(recompressPdfScannedImages(source, {}, controller.signal)).rejects.toThrow();
  });
});
