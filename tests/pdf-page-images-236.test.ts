import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import {
  browserPdfImageCapability236,
  exportPdfPageImages236,
  PDF_IMAGES_236_MAX_INPUT_BYTES,
  type PdfImages236Host,
} from "../src/engines/pdf/page-images-236";

const bytes = (name: string): Uint8Array => new Uint8Array(readFileSync(new URL("../quality/fixtures/pdf-gold/" + name, import.meta.url)));
const blob = (data: Uint8Array): Blob => new Blob([new Uint8Array(data)], { type: "application/pdf" });
const hash = (input: Uint8Array): string => createHash("sha256").update(input).digest("hex");

/** Standalone stdlib zipfile and Pillow decoders, independent of fflate/sharp. */
function pythonReopenImages(payload: {
  readonly items: readonly { readonly filename: string; readonly mime: string; readonly bytes: Uint8Array }[];
  readonly archive?: Uint8Array;
  readonly expectedWidth: number;
  readonly expectedHeight: number;
  readonly expectedBackground?: readonly number[];
}): string {
  const toB64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");
  const serializable = {
    items: payload.items.map((item) => ({ name: item.filename, mime: item.mime, base64: toB64(item.bytes) })),
    archive: payload.archive === undefined ? null : toB64(payload.archive),
    width: payload.expectedWidth, height: payload.expectedHeight,
    background: payload.expectedBackground ?? null,
  };
  const python = String.raw`
import base64, hashlib, io, json, sys, zipfile
from PIL import Image
data = json.load(sys.stdin)
images = []
names = []
for item in data['items']:
    raw = base64.b64decode(item['base64'])
    with Image.open(io.BytesIO(raw)) as frame:
        frame.load()
        assert frame.format == ('PNG' if item['mime'] == 'image/png' else 'JPEG')
        assert frame.size == (data['width'], data['height'])
        rgb = frame.convert('RGB')
        if data['background'] is not None:
            assert rgb.getpixel((0, 0)) == tuple(data['background'])
        images.append(hashlib.sha256(rgb.tobytes()).hexdigest())
    names.append(item['name'])
if len(names) > 1:
    assert len(set(images)) == len(images), 'distinct PDF pages have identical raster pixels'
if data['archive'] is not None:
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(data['archive'])), 'r') as z:
        assert z.namelist() == names, (z.namelist(), names)
        for item in data['items']:
            assert z.read(item['name']) == base64.b64decode(item['base64'])
            assert z.getinfo(item['name']).compress_type == zipfile.ZIP_STORED
print('PYTHON_PILLOW_ZIPFILE_INDEPENDENT_ROUNDTRIP_PASS', 'images', len(images),
      'pixels_each', data['width'] * data['height'], 'zip', bool(data['archive']))
`;
  return execFileSync("python3", ["-c", python], { input: JSON.stringify(serializable), encoding: "utf8" }).trim();
}

/** Genuine PDF.js rendering through the installed @napi-rs/canvas. */
function realNodeHost(options: { onRender?: (page: number) => void; onClose?: () => void; onCleanup?: () => void } = {}): PdfImages236Host {
  return {
    capability: () => ({ png: true, jpeg: true, reason: "Node PDF.js + local napi canvas verified by sharp" }),
    async open(data, signal) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const loading = getDocument({ data: data.slice(), useSystemFonts: true });
      const document = await loading.promise;
      return {
        pageCount: document.numPages,
        async getPage(number) {
          const page = await document.getPage(number);
          return {
            viewport(scale) {
              const nativeViewport = page.getViewport({ scale });
              return { width: nativeViewport.width, height: nativeViewport.height, nativeViewport };
            },
            async render(config, renderSignal) {
              options.onRender?.(number);
              if (renderSignal?.aborted) throw new DOMException("Cancelled", "AbortError");
              const canvas = createCanvas(config.width, config.height);
              const task = page.render({
                canvas: canvas as never,
                canvasContext: canvas.getContext("2d") as never,
                viewport: config.viewport.nativeViewport as ReturnType<typeof page.getViewport>,
                background: config.background,
              });
              const abortRender = () => task.cancel();
              renderSignal?.addEventListener("abort", abortRender, { once: true });
              try {
                await task.promise;
                if (renderSignal?.aborted) throw new DOMException("Cancelled", "AbortError");
                return new Uint8Array(config.mime === "image/png"
                  ? canvas.toBuffer("image/png")
                  : canvas.toBuffer("image/jpeg", Math.round(config.quality * 100)));
              } finally {
                renderSignal?.removeEventListener("abort", abortRender);
                canvas.width = canvas.height = 0;
              }
            },
            cleanup() { options.onCleanup?.(); page.cleanup(); },
          };
        },
        async close() { options.onClose?.(); await loading.destroy(); },
      };
    },
  };
}

describe("#236 bounded independent PDF.js PDF-page raster to image/ZIP", () => {
  it("renders selected pages in requested order, verified dimensions/content, true PNG signatures and exact ZIP byte identity", async () => {
    const closings: number[] = [];
    const cleanups: number[] = [];
    const file = blob(bytes("simple-3page.pdf"));
    const out = await exportPdfPageImages236(file, {
      pages: "3,1-2", scale: 0.5, mime: "image/png", background: "#12ab34",
    }, undefined, realNodeHost({ onClose: () => closings.push(1), onCleanup: () => cleanups.push(1) }));
    expect(out).toMatchObject({
      selectedPages: [3, 1, 2], pageCount: 3, scale: 0.5, effectiveDpi: 36,
      failures: [], fidelity: "raster-visual-only", inputBytes: file.size,
    });
    expect(out.caveat).toMatch(/not securely removed or redacted/);
    expect(out.files.map((item) => item.filename)).toEqual(["page-003.png", "page-001.png", "page-002.png"]);
    expect(out.files.map((item) => item.page)).toEqual([3, 1, 2]);
    expect(out.files.map((item) => [item.width, item.height])).toEqual([[306, 396], [306, 396], [306, 396]]);
    const decodedHashes: string[] = [];
    for (const raster of out.files) {
      expect(raster.bytes.slice(0, 8)).toEqual(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(raster.byteLength).toBe(raster.bytes.length);
      const image = sharp(raster.bytes);
      const metadata = await image.metadata();
      expect(metadata.format).toBe("png");
      expect([metadata.width, metadata.height]).toEqual([306, 396]);
      const raw = await image.removeAlpha().raw().toBuffer();
      expect([...raw.slice(0, 3)]).toEqual([18, 171, 52]);
      decodedHashes.push(hash(raw));
    }
    expect(new Set(decodedHashes).size).toBe(3);
    expect(out.outputBytes).toBe(out.files.reduce((sum, item) => sum + item.bytes.length, 0));
    expect(out.totalPixels).toBe(306 * 396 * 3);
    expect(out.zip).not.toBeNull();
    expect(out.zip!.entryNames).toEqual(out.files.map((item) => item.filename));
    const reopened = unzipSync(out.zip!.bytes);
    for (const item of out.files) expect(reopened[item.filename]).toEqual(item.bytes);
    expect(pythonReopenImages({
      items: out.files,
      archive: out.zip!.bytes,
      expectedWidth: 306, expectedHeight: 396,
      expectedBackground: [18, 171, 52],
    })).toContain("PYTHON_PILLOW_ZIPFILE_INDEPENDENT_ROUNDTRIP_PASS images 3");
    console.info(`PDF_236_PNG_ZIP_PROOF pages=3 resolution=306x396 image_bytes=${out.files.map((item) => item.byteLength).join(",")} total_image_bytes=${out.outputBytes} zip_bytes=${out.zip!.bytes.length}`);
    expect(closings).toHaveLength(1);
    expect(cleanups).toHaveLength(3);
  }, 15_000);

  it("produces independently decoded JPEG for page two of a real three-page PDF", async () => {
    const source = blob(bytes("simple-3page.pdf"));
    const result = await exportPdfPageImages236(source, {
      pages: [2], mime: "image/jpeg", scale: 1, quality: 0.8, background: "#ffffff",
    }, undefined, realNodeHost());
    expect(result.files).toHaveLength(1);
    expect(result.zip).toBeNull();
    const raster = result.files[0]!;
    expect(raster.filename).toBe("page-002.jpg");
    expect([...raster.bytes.slice(0, 3)]).toEqual([255, 216, 255]);
    expect([...raster.bytes.slice(-2)]).toEqual([255, 217]);
    const metadata = await sharp(raster.bytes).metadata();
    expect(metadata.format).toBe("jpeg");
    expect([metadata.width, metadata.height]).toEqual([612, 792]);
    expect(result.outputBytes).toBe(raster.bytes.length);
    expect(pythonReopenImages({ items: [raster], expectedWidth: 612, expectedHeight: 792 }))
      .toContain("PYTHON_PILLOW_ZIPFILE_INDEPENDENT_ROUNDTRIP_PASS images 1");
    console.info(`PDF_236_JPEG_PROOF page=2 resolution=612x792 jpeg_bytes=${raster.byteLength}`);
  }, 15_000);

  it("fails closed before opening PDF on wrong signature, unsupported format, invalid options, byte limit or incapable renderer", async () => {
    const input = blob(bytes("simple-3page.pdf"));
    let opens = 0;
    const host = { ...realNodeHost(), open: async (...args: Parameters<PdfImages236Host["open"]>) => {
      opens++;
      return realNodeHost().open(...args);
    } };
    for (const invalid of [
      { mime: "image/webp" as "image/png" }, { scale: 3 }, { scale: NaN }, { quality: 0 }, { background: "#fff" },
    ]) {
      await expect(exportPdfPageImages236(input, invalid, undefined, host)).rejects.toThrow(/PDF_236_/);
    }
    await expect(exportPdfPageImages236(new Blob([new Uint8Array(20)]), {}, undefined, host)).rejects.toThrow(/INVALID_PDF/);
    await expect(exportPdfPageImages236(new Blob([new Uint8Array(PDF_IMAGES_236_MAX_INPUT_BYTES + 1)]), {}, undefined, host))
      .rejects.toThrow(/INPUT_LIMIT/);
    await expect(exportPdfPageImages236(input, {}, undefined, {
      ...host, capability: () => ({ png: false, jpeg: false, reason: "Codec unavailable" }),
    })).rejects.toThrow(/UNSUPPORTED_CODEC/);
    expect(opens).toBe(0);
    expect(browserPdfImageCapability236().png).toBe(false);
  });

  it("refuses malformed/out-of-bounds/duplicate selections without returning incomplete files or ZIP", async () => {
    const input = blob(bytes("simple-3page.pdf"));
    for (const pages of ["2,2", "3-1", "4", "1-4", "1,,2", "0", "2-", "3,1-3"]) {
      await expect(exportPdfPageImages236(input, { pages }, undefined, realNodeHost())).rejects.toThrow();
    }
    await expect(exportPdfPageImages236(input, { pages: [2, 2] }, undefined, realNodeHost())).rejects.toThrow();
  }, 25_000);

  it("isolate one page render failure, close all pages and ZIP only successful entries", async () => {
    let closed = 0;
    let cleaned = 0;
    const original = realNodeHost({ onClose: () => closed++, onCleanup: () => cleaned++ });
    const brokenHost: PdfImages236Host = {
      capability: original.capability,
      async open(bytes, signal) {
        const pdf = await original.open(bytes, signal);
        return {
          ...pdf,
          async getPage(n) {
            const page = await pdf.getPage(n);
            return n === 2
              ? { ...page, async render(): Promise<Uint8Array> { throw new Error("PAGE_2_REJECTED"); } }
              : page;
          },
        };
      },
    };
    const result = await exportPdfPageImages236(blob(bytes("simple-3page.pdf")),
      { pages: "3,2,1", scale: 0.5 }, undefined, brokenHost);
    expect(result.failures).toEqual([{ page: 2, reason: "PAGE_2_REJECTED" }]);
    expect(result.files.map((item) => item.page)).toEqual([3, 1]);
    expect(result.zip?.entryNames).toEqual(["page-003.png", "page-001.png"]);
    expect(cleaned).toBe(3);
    expect(closed).toBe(1);
  }, 15_000);

  it("rejects a page whose viewport exceeds the pixel ceiling before allocating a canvas", async () => {
    let rendered = 0;
    let cleaned = 0;
    let closed = 0;
    const original = realNodeHost({ onRender: () => rendered++, onCleanup: () => cleaned++, onClose: () => closed++ });
    const oversized: PdfImages236Host = {
      capability: original.capability,
      async open(source, signal) {
        const pdf = await original.open(source, signal);
        return {
          ...pdf,
          async getPage(number) {
            const page = await pdf.getPage(number);
            return {
              ...page,
              viewport(scale) {
                return { ...page.viewport(scale), width: 2000, height: 2000 };
              },
            };
          },
        };
      },
    };
    await expect(exportPdfPageImages236(blob(bytes("simple-3page.pdf")),
      { pages: [1] }, undefined, oversized)).rejects.toThrow(/RENDER_FAILED.*PIXEL_LIMIT/);
    expect(rendered).toBe(0);
    expect(cleaned).toBe(1);
    expect(closed).toBe(1);
  }, 15_000);

  it("terminates cleanly on cancellation before load and after starting a render", async () => {
    const source = blob(bytes("simple-3page.pdf"));
    const preCancelled = new AbortController();
    preCancelled.abort();
    await expect(exportPdfPageImages236(source, { pages: [1] }, preCancelled.signal, realNodeHost()))
      .rejects.toMatchObject({ name: "AbortError" });
    const controller = new AbortController();
    let closed = 0;
    const host = realNodeHost({ onRender: () => controller.abort(), onClose: () => closed++ });
    await expect(exportPdfPageImages236(source, { pages: [1] }, controller.signal, host))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(closed).toBe(1);
  }, 15_000);
});
