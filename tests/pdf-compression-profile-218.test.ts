import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectPdfBytes } from "../src/engines/pdf";
import { describePdfStructuralCompression } from "../src/engines/pdf/compression-profile";
import compression from "../src/tools/pdf-compression-lite/module";
import type { PdfCompressionOutput } from "../src/tools/pdf-compression-lite/types";

function fixture(name: string): Blob {
  const bytes = readFileSync(new URL(`../quality/fixtures/pdf-gold/${name}`, import.meta.url));
  return new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" });
}

describe("218 — structural PDF compression analysis must not imply image recompression", () => {
  it("inventories real embedded image XObjects while touching none", async () => {
    const blob = fixture("jpeg-1page.pdf");
    const result = await compression.run({ file: blob, profile: "structural-only" }, { defaults: {} }) as PdfCompressionOutput;
    expect(result).toHaveProperty("analysis");
    expect(result.analysis.profile).toBe("structural-only");
    expect(result.analysis.images.discovered).toBeGreaterThan(0);
    expect(result.analysis.images.touched).toBe(0);
    expect(result.analysis.images.skipped).toBe(result.analysis.images.discovered);
    expect(result.analysis.images.inventory.every((image) => image.action === "unchanged" && image.estimatedDpi === null)).toBe(true);
    expect(result.analysis.images.downsampleApplied).toBe(false);
    expect(result.analysis.images.recompressionApplied).toBe(false);
    expect(result.analysis.images.grayscaleApplied).toBe(false);
    expect(result.analysis.verification.pageCountUnchanged).toBe(true);
    expect(result.analysis.verification.pageGeometryUnchanged).toBe(true);
    expect(result.analysis.verification.pixelVisualParity).toBe("not-verified");
    expect(result.analysis.verification.extractedTextParity).toBe("not-verified");
    expect(result.artifactCount).toBe(1);
    expect(result.analysis.outputBytes).toBe(result.artifacts[0]!.bytes.byteLength);
  });

  it("reports source/output growth and recommends keeping the original when result is not smaller", () => {
    const inspection = inspectPdfBytes(new Uint8Array(readFileSync(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url))));
    const grown = describePdfStructuralCompression(inspection, { ...inspection, byteLength: inspection.byteLength + 5 });
    expect(grown).toMatchObject({ deltaBytes: 5, savedBytes: 0, recommendOriginal: true });
    expect(grown.warnings.join(" ")).toMatch(/conservare il file originale/u);
    const smaller = describePdfStructuralCompression(inspection, { ...inspection, byteLength: inspection.byteLength - 5 });
    expect(smaller).toMatchObject({ deltaBytes: -5, savedBytes: 5, recommendOriginal: false });
    const same = describePdfStructuralCompression(inspection, inspection);
    expect(same.recommendOriginal).toBe(true);
    expect(() => describePdfStructuralCompression(inspection, { ...inspection, pageCount: 999 })).toThrow(/PDF_OUTPUT_MISMATCH/u);
    expect(() => describePdfStructuralCompression(inspection, { ...inspection, pages: [{ ...inspection.pages[0]!, width: 999 }] })).toThrow(/PDF_OUTPUT_MISMATCH/u);
  });

  it.each([{ profile: "image-aware" }, { profile: "scan" }, { profile: "super-fast" }, { grayscale: true }])(
    "refuses unsupported image modification option %j instead of silently taking structural-only path", async (options) => {
      await expect(compression.run({ file: fixture("jpeg-1page.pdf"), ...options }, { defaults: {} }))
        .rejects.toThrow(/UNSUPPORTED_CAPABILITY/u);
    },
  );

  it("does not modify the uploaded source bytes", async () => {
    const source = fixture("simple-2page.pdf");
    const original = new Uint8Array(await source.arrayBuffer());
    await compression.run({ file: source }, { defaults: {} });
    expect(new Uint8Array(await source.arrayBuffer())).toEqual(original);
  });

  it("fails early on the local size cap and honors a pre-aborted signal", async () => {
    const huge = new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: "application/pdf" });
    await expect(compression.run({ file: huge }, { defaults: {} })).rejects.toThrow(/PDF_LIMIT/u);
    const controller = new AbortController();
    controller.abort();
    await expect(compression.run({ file: fixture("jpeg-1page.pdf") }, { defaults: {} }, controller.signal)).rejects.toThrow();
  });
});
