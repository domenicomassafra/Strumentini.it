import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { recompressPdfEmbeddedJpegs } from "../src/engines/pdf/jpeg-image-aware";
import { pdfImageCompositingRisk218 } from "../src/engines/pdf/image-aware-safety-218";
import { recompressPdfScannedImages } from "../src/engines/pdf/scan-image-aware";
import {
  nameValue, parsePdf, pdfArray, pdfDict, pdfName, pdfNumber, type PdfValue,
} from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";

const WIDTH = 160;
const HEIGHT = 120;

function rgb(): Uint8Array {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const at = (y * WIDTH + x) * 3;
    pixels[at] = (x * 5 + y * 3 + (x ^ y) * 2) & 255;
    pixels[at + 1] = (x * 11 + y * 7) & 255;
    pixels[at + 2] = (x * 13 + y * 9) & 255;
  }
  return pixels;
}

type Scenario = "blend" | "group" | "form" | "pattern" | "simple" | "plain";
async function fixture(scenario: Scenario, options: { overinflate?: boolean } = {}): Promise<Uint8Array> {
  const builder = new PdfBuilder();
  const root = builder.reserve();
  const pages = builder.reserve();
  const page = builder.reserve();
  const raw = rgb();
  const rawJpeg = new Uint8Array(await sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .jpeg({ quality: 100 }).toBuffer());
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let i = 0; i < mask.length; i++) mask[i] = i % 256;
  const maskImage = scenario === "plain" ? null : builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(WIDTH), Height: pdfNumber(HEIGHT),
    ColorSpace: pdfName("DeviceGray"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
  }), bytes: new Uint8Array(deflateSync(mask)) });
  const jpeg = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(WIDTH), Height: pdfNumber(HEIGHT),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("DCTDecode"),
  }), bytes: rawJpeg });
  const flate = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(WIDTH), Height: pdfNumber(HEIGHT),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
  }), bytes: new Uint8Array(deflateSync(options.overinflate ? new Uint8Array(2 * 1024 * 1024) : raw)) });
  const maskedJpeg = maskImage === null ? null : builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(WIDTH), Height: pdfNumber(HEIGHT),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("DCTDecode"),
    SMask: maskImage,
  }), bytes: rawJpeg });
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const ext = builder.putAuto(pdfDict({ Type: pdfName("ExtGState"), BM: pdfName("Multiply"), ca: pdfNumber(0.5) }));
  const form = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Form"), BBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(160), pdfNumber(120)]),
    Resources: pdfDict({}),
  }), bytes: new TextEncoder().encode("0 1 0 rg 5 5 30 20 re f\n") });
  const content = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(
    "q 160 0 0 120 0 0 cm /ImFlate Do Q\n" +
    `q ${scenario === "blend" ? "/GSBlend gs " : ""}60 0 0 45 20 15 cm /ImJpeg Do Q\n` +
    (maskedJpeg === null ? "" : "q 45 0 0 35 105 65 cm /ImMasked Do Q\n") +
    `${scenario === "form" ? "q /Fm1 Do Q\n" : ""}` +
    "BT /F1 15 Tf 5 150 Td (VECTOR-IMAGE-SAFETY-218) Tj ET\n",
  ) });
  const baseResources: Record<string, PdfValue> = {
    Font: pdfDict({ F1: font }),
    XObject: pdfDict({ ImFlate: flate, ImJpeg: jpeg, ...(maskedJpeg === null ? {} : { ImMasked: maskedJpeg }), ...(scenario === "form" ? { Fm1: form } : {}) }),
    ...(scenario === "blend" ? { ExtGState: pdfDict({ GSBlend: ext }) } : {}),
    ...(scenario === "pattern" ? { Pattern: pdfDict({ P1: pdfDict({ PatternType: pdfNumber(1) }) }) } : {}),
  };
  const pageDict = pdfDict({
    Type: pdfName("Page"), Parent: pages, MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(160), pdfNumber(165)]),
    Resources: pdfDict(baseResources), Contents: content,
    ...(scenario === "group" ? { Group: pdfDict({ S: pdfName("Transparency"), I: pdfName("true") }) } : {}),
  });
  builder.put(page, pageDict);
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  builder.put(root, pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return builder.build(root, null);
}

function snapshot(bytes: Uint8Array): Array<{ id: number; filter: string | null; length: number; sha256: string }> {
  return [...parsePdf(bytes).objects.values()]
    .filter((obj) => obj.value.kind === "stream" && nameValue(obj.value.dictionary.entries.get("Subtype")) === "Image")
    .map((obj) => {
      if (obj.value.kind !== "stream") throw new Error("Unreachable");
      return {
        id: obj.id, filter: nameValue(obj.value.dictionary.entries.get("Filter")),
        length: obj.value.bytes.length, sha256: createHash("sha256").update(obj.value.bytes).digest("hex"),
      };
    });
}

async function realPdfJsPng(bytes: Uint8Array): Promise<Uint8Array> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const doc = await loading.promise;
    const page = await doc.getPage(1);
    try {
      const viewport = page.getViewport({ scale: 1 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport,
        background: "#ffffff" }).promise;
      return new Uint8Array(canvas.toBuffer("image/png"));
    } finally {
      page.cleanup();
    }
  } finally {
    await loading.destroy();
  }
}

function independentPillowVerify(first: Uint8Array, second: Uint8Array): void {
  const text = execFileSync("python3", ["-c", String.raw`
import base64, hashlib, io, json, sys
from PIL import Image
source, output = json.load(sys.stdin)
with Image.open(io.BytesIO(base64.b64decode(source))) as a, Image.open(io.BytesIO(base64.b64decode(output))) as b:
    a.load(); b.load()
    assert a.format == b.format == "PNG", (a.format, b.format)
    assert a.size == b.size
    assert a.tobytes() == b.tobytes()
    print('PILLOW_INDEPENDENT_PDF_VISUAL_PARITY_PASS', a.size, 'pixel_bytes', len(a.tobytes()))
`], { input: JSON.stringify([Buffer.from(first).toString("base64"), Buffer.from(second).toString("base64")]),
    encoding: "utf8" });
  expect(text).toContain("PILLOW_INDEPENDENT_PDF_VISUAL_PARITY_PASS");
}

afterEach(() => vi.unstubAllGlobals());

describe("#218 mixed XObjects/transparency compression gate", () => {
  it("refuses a real PDF with ExtGState Multiply blend and a linked soft-mask image without modifying PDF or images", async () => {
    const source = await fixture("blend");
    const origin = source.slice();
    expect(pdfImageCompositingRisk218(parsePdf(source))).toBe("page-extgstate-compositing-unsupported");
    const before = inspectPdfBytes(source);
    expect(before.pageCount).toBe(1);
    const scan = await recompressPdfScannedImages(source);
    const jpeg = await recompressPdfEmbeddedJpegs(source);
    for (const result of [scan, jpeg]) {
      expect(result.artifact.bytes).toEqual(source);
      expect(result.analysis).toMatchObject({ touched: 0, recommendOriginal: true });
      expect(result.analysis.inventory.every((item) => item.action === "unchanged"
        && item.reason === "page-extgstate-compositing-unsupported")).toBe(true);
      expect(result.analysis.inventory.length).toBe(4);
      expect(snapshot(result.artifact.bytes)).toEqual(snapshot(source));
      expect(inspectPdfBytes(result.artifact.bytes).pages.map(({ width, height, rotation }) => ({ width, height, rotation })))
        .toEqual(before.pages.map(({ width, height, rotation }) => ({ width, height, rotation })));
      expect((await extractPdfText(result.artifact.bytes))[0]?.text).toContain("VECTOR-IMAGE-SAFETY-218");
    }
    expect(source).toEqual(origin);
    // Independent image codec proves JPEG bytes valid; scan Flate raw pixels are bounded and decodable.
    const model = parsePdf(source);
    const images = [...model.objects.values()].filter((obj) => obj.value.kind === "stream" &&
      nameValue(obj.value.dictionary.entries.get("Subtype")) === "Image");
    let decodedJpeg = 0;
    let decodedFlate = 0;
    for (const obj of images) {
      if (obj.value.kind !== "stream") continue;
      const filter = nameValue(obj.value.dictionary.entries.get("Filter"));
      if (filter === "DCTDecode") {
        const image = await sharp(obj.value.bytes).metadata();
        expect([image.width, image.height, image.format]).toEqual([WIDTH, HEIGHT, "jpeg"]);
        decodedJpeg++;
      }
      if (filter === "FlateDecode") {
        const raw = inflateSync(obj.value.bytes);
        expect(raw.byteLength).toBeGreaterThan(0);
        decodedFlate++;
      }
    }
    expect([decodedJpeg, decodedFlate]).toEqual([2, 2]);
    const beforeRender = await realPdfJsPng(source);
    expect(beforeRender.length).toBeGreaterThan(100);
    const afterRender = await realPdfJsPng(scan.artifact.bytes);
    independentPillowVerify(beforeRender, afterRender);
  }, 20_000);

  it.each([
    ["group", "page-transparency-group-unsupported"],
    ["form", "nested-form-xobject-compositing-unsupported"],
    ["pattern", "page-pattern-compositing-unsupported"],
  ] as const)("rejects unsupported %s resource graph with a specific refusal reason", async (scenario, expected) => {
    const source = await fixture(scenario);
    expect(pdfImageCompositingRisk218(parsePdf(source))).toBe(expected);
    for (const result of [await recompressPdfScannedImages(source), await recompressPdfEmbeddedJpegs(source)]) {
      expect(result.artifact.bytes).toEqual(source);
      expect(result.analysis).toMatchObject({ touched: 0, recommendOriginal: true });
      expect(result.analysis.inventory.every((image) => image.reason === expected)).toBe(true);
    }
  }, 30_000);

  it("refuses a linked soft mask even without blending, and honors pre-aborted jobs", async () => {
    const source = await fixture("simple");
    expect(pdfImageCompositingRisk218(parsePdf(source))).toBe("indirect-image-mask-compositing-unsupported");
    for (const result of [await recompressPdfScannedImages(source), await recompressPdfEmbeddedJpegs(source)]) {
      expect(result.artifact.bytes).toEqual(source);
      expect(result.analysis.inventory.every((image) => image.reason === "indirect-image-mask-compositing-unsupported")).toBe(true);
    }
    const abort = new AbortController();
    abort.abort();
    await expect(recompressPdfScannedImages(source, {}, abort.signal)).rejects.toMatchObject({ name: "AbortError" });
    await expect(recompressPdfEmbeddedJpegs(source, {}, abort.signal)).rejects.toMatchObject({ name: "AbortError" });
  }, 60_000);

  it("recompresses a simple Flate + JPEG mixed PDF, frees native canvas backing stores and bounds lossy visual changes", async () => {
    const source = await fixture("plain");
    expect(pdfImageCompositingRisk218(parsePdf(source))).toBeNull();
    const surfaces: Array<{ width: number; height: number }> = [];
    vi.stubGlobal("document", {
      createElement(kind: string) {
        if (kind !== "canvas") throw new Error("Unexpected DOM element");
        const canvas = createCanvas(1, 1);
        surfaces.push(canvas);
        Object.assign(canvas, {
          toBlob(done: (value: Blob | null) => void, mime: string, quality: number) {
            try {
              if (mime !== "image/jpeg") throw new Error("Expected JPEG codec");
              const encoded = canvas.toBuffer("image/jpeg", Math.round(quality * 100));
              done(new Blob([new Uint8Array(encoded)], { type: "image/jpeg" }));
            } catch { done(null); }
          },
        });
        return canvas;
      },
    });
    const result = await recompressPdfScannedImages(source, { quality: 0.65, maxLongestEdgePx: 256 });
    expect(result.artifact.bytes.byteLength).toBeLessThan(source.byteLength);
    expect(result.analysis).toMatchObject({ touched: 1, skipped: 1, downsampleApplied: false, recommendOriginal: false });
    expect(result.analysis.inventory.find((item) => item.action === "recompressed"))
      .toMatchObject({ outputWidth: 160, outputHeight: 120 });
    expect(surfaces).toHaveLength(1);
    expect(surfaces.every((surface) => surface.width === 1 && surface.height === 1)).toBe(true);
    const originalModel = parsePdf(source);
    const outputModel = parsePdf(result.artifact.bytes);
    const findJpeg = (model: ReturnType<typeof parsePdf>) => [...model.objects.values()]
      .filter((object) => object.value.kind === "stream" &&
        nameValue(object.value.dictionary.entries.get("Filter")) === "DCTDecode" &&
        nameValue(object.value.dictionary.entries.get("Subtype")) === "Image");
    expect(findJpeg(originalModel)).toHaveLength(1);
    expect(findJpeg(outputModel)).toHaveLength(2);
    const converted = findJpeg(outputModel).find((object) => {
      const value = object.value;
      return value.kind === "stream" && value.bytes.length < 10_000;
    });
    expect(converted).toBeDefined();
    if (converted?.value.kind !== "stream") throw new Error("JPEG output not found");
    const dimensions = await sharp(converted.value.bytes).metadata();
    expect([dimensions.width, dimensions.height, dimensions.format]).toEqual([160, 120, "jpeg"]);
    expect((await extractPdfText(result.artifact.bytes))[0]?.text).toContain("VECTOR-IMAGE-SAFETY-218");
    const a = await realPdfJsPng(source);
    const b = await realPdfJsPng(result.artifact.bytes);
    const before = await sharp(a).removeAlpha().raw().toBuffer();
    const after = await sharp(b).removeAlpha().raw().toBuffer();
    expect(before.byteLength).toBe(after.byteLength);
    let difference = 0;
    for (let i = 0; i < before.length; i++) difference += Math.abs(before[i]! - after[i]!);
    const mean = difference / before.length;
    expect(mean).toBeLessThan(40);
    console.info(`PDF_218_SAFE_MIXED_RECOMPRESS original=${source.byteLength} compressed=${result.artifact.bytes.byteLength} page_rgb_delta=${mean.toFixed(2)} canvases_released=${surfaces.length}`);
  }, 20_000);

  it("refuses Flate expansion beyond claimed raster size before any canvas work", async () => {
    const source = await fixture("plain", { overinflate: true });
    let canvasAllocations = 0;
    vi.stubGlobal("document", { createElement: () => { canvasAllocations++; throw new Error("Canvas must not be reached"); } });
    await expect(recompressPdfScannedImages(source)).rejects.toThrow(/PDF_LIMIT: Flate image expanded beyond predicted raster dimensions/);
    expect(canvasAllocations).toBe(0);
  }, 10_000);
});
