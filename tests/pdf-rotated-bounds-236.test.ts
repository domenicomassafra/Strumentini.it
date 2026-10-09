import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { unzipSync } from "fflate";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { exportPdfPageImages236, PDF_IMAGES_236_MAX_INPUT_BYTES, type PdfImages236Host } from "../src/engines/pdf/page-images-236";
// The fixture is intentionally a standalone, native-Node JavaScript writer also
// consumed unchanged by the full three-engine Playwright acceptance.
// @ts-ignore isolated test-only .mjs corpus without separate declaration
import { makeRotatedCropPdf236 } from "./fixtures/pdf-rotated-236-corpus.mjs";

const fixture = (): Blob => new Blob([makeRotatedCropPdf236()], { type: "application/pdf" });

function genuinePdfJsHost236(onRender?: () => void, onClose?: () => void, onCleanup?: () => void): PdfImages236Host {
  return {
    capability: () => ({ png: true, jpeg: true, reason: "PDF.js + independent @napi-rs/canvas host" }),
    async open(data, signal) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const loading = getDocument({ data: data.slice(), useSystemFonts: false });
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
              onRender?.();
              if (renderSignal?.aborted) throw new DOMException("Cancelled", "AbortError");
              const canvas = createCanvas(config.width, config.height);
              const task = page.render({ canvas: canvas as never,
                canvasContext: canvas.getContext("2d") as never,
                viewport: config.viewport.nativeViewport as ReturnType<typeof page.getViewport>,
                background: config.background });
              const abort = () => task.cancel();
              renderSignal?.addEventListener("abort", abort, { once: true });
              try {
                await task.promise;
                if (renderSignal?.aborted) throw new DOMException("Cancelled", "AbortError");
                const output = config.mime === "image/png"
                  ? canvas.toBuffer("image/png")
                  : canvas.toBuffer("image/jpeg", Math.round(config.quality * 100));
                return new Uint8Array(output);
              } finally {
                renderSignal?.removeEventListener("abort", abort);
                canvas.width = canvas.height = 0;
              }
            },
            cleanup() { onCleanup?.(); page.cleanup(); },
          };
        },
        async close() { onClose?.(); await loading.destroy(); },
      };
    },
  };
}

describe("#236 true rotated CropBox/alpha PDF export resource acceptance", () => {
  it("returns four rotated CropBox PNGs in the requested ZIP order at 72 effective DPI", async () => {
    let closed = 0;
    let cleaned = 0;
    const result = await exportPdfPageImages236(fixture(), {
      pages: "2,4,1,3", mime: "image/png", scale: 1, background: "#15304d",
    }, undefined, genuinePdfJsHost236(undefined, () => closed++, () => cleaned++));
    expect(result.effectiveDpi).toBe(72);
    expect(result.fidelity).toBe("raster-visual-only");
    expect(result.selectedPages).toEqual([2, 4, 1, 3]);
    expect(result.files.map((f) => f.filename)).toEqual(["page-002.png", "page-004.png", "page-001.png", "page-003.png"]);
    expect(result.files.map((f) => [f.width, f.height])).toEqual([[100, 180], [100, 180], [180, 100], [180, 100]]);
    for (const f of result.files) {
      expect((await sharp(f.bytes).metadata()).format).toBe("png");
      const corner = await sharp(f.bytes).ensureAlpha().raw().toBuffer();
      expect([...corner.subarray(0, 4)]).toEqual([21, 48, 77, 255]);
    }
    expect(result.failures).toEqual([]);
    expect(result.zip?.entryNames).toEqual(result.files.map((file) => file.filename));
    const unpacked = unzipSync(result.zip!.bytes);
    for (const f of result.files) expect(unpacked[f.filename]).toEqual(f.bytes);
    expect(cleaned).toBe(4);
    expect(closed).toBe(1);
  }, 20_000);

  it("decodes an actual crop-rotated JPEG with 36 DPI and 50x90 pixel geometry", async () => {
    const result = await exportPdfPageImages236(fixture(), {
      pages: "2", mime: "image/jpeg", scale: 0.5, quality: 0.8,
    }, undefined, genuinePdfJsHost236());
    expect(result.effectiveDpi).toBe(36);
    expect(result.files.map(({ filename, width, height }) => [filename, width, height]))
      .toEqual([["page-002.jpg", 50, 90]]);
    expect(result.zip).toBeNull();
    const decoded = await sharp(result.files[0]!.bytes).metadata();
    expect(decoded).toMatchObject({ format: "jpeg", width: 50, height: 90 });
  }, 15_000);

  it("refuses >8 MiB input before loading any PDF or allocating any page", async () => {
    let opens = 0;
    const base = genuinePdfJsHost236();
    const host: PdfImages236Host = { ...base, async open(bytes, signal) { opens++; return base.open(bytes, signal); } };
    const oversized = new Blob([new Uint8Array(PDF_IMAGES_236_MAX_INPUT_BYTES + 1)]);
    await expect(exportPdfPageImages236(oversized, {}, undefined, host)).rejects.toThrow(/PDF_236_INPUT_LIMIT/u);
    expect(opens).toBe(0);
  });

  it("refuses selected page count >8 before any render and still closes the host", async () => {
    let closed = 0;
    let pageLoads = 0;
    const base = genuinePdfJsHost236();
    const host: PdfImages236Host = { ...base, async open(data, signal) {
      const pdf = await base.open(data, signal);
      return { ...pdf, pageCount: 9,
        async getPage(n) { pageLoads++; return pdf.getPage(n); },
        async close() { closed++; await pdf.close(); } };
    } };
    await expect(exportPdfPageImages236(fixture(), {}, undefined, host)).rejects.toThrow(/PDF_236_PAGE_LIMIT/u);
    expect(pageLoads).toBe(0);
    expect(closed).toBe(1);
  });

  it("aborts the real rendering operation without a partial PNG or ZIP and closes PDF.js", async () => {
    const controller = new AbortController();
    let closed = 0;
    let cleaned = 0;
    const host = genuinePdfJsHost236(() => controller.abort(), () => closed++, () => cleaned++);
    await expect(exportPdfPageImages236(fixture(), {
      pages: "1,2,3", mime: "image/png",
    }, controller.signal, host)).rejects.toMatchObject({ name: "AbortError" });
    expect(closed).toBe(1);
    expect(cleaned).toBe(1);
  }, 15_000);
});
