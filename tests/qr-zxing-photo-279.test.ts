import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readQrPixels } from "../src/engines/qr";
import { readQrPixelsWithZxing } from "../src/engines/qr/zxing-adapter";

/**
 * The photo fixtures come from the independent `qrcode@1.5.4` encoder with
 * photographic degradations (rotation, blur, low contrast, uneven light), so a
 * decoder that only imitates Strumentini's own encoder cannot pass. The native
 * decoder must refuse them and the ZXing fallback must read them, which is the
 * contract the mobile acceptance lane also asserts.
 */
const fixtureDir = resolve(import.meta.dirname, "../quality/fixtures/qr-contract");
const manifest = JSON.parse(await readFile(resolve(fixtureDir, "qr-279-photo-manifest.json"), "utf8")) as {
  fixtures: { file: string; payload: string; errorCorrectionLevel: string; sha256: string }[];
};

function fakeCanvasRuntime() {
  // Only the pixel-only browser interface ZXing uses is stubbed; the decoder is real.
  vi.stubGlobal("ImageData", class {
    constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {}
  });
  vi.stubGlobal("document", {
    createElement: () => {
      let imageData: { data: Uint8ClampedArray } | undefined;
      const context = {
        putImageData: (value: { data: Uint8ClampedArray }) => { imageData = value; },
        getImageData: () => imageData,
      };
      return { width: 0, height: 0, getContext: () => context };
    },
  });
}

async function pixelsOf(file: string) {
  const bytes = await readFile(resolve(fixtureDir, file));
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { bytes, pixels: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) } };
}

afterEach(() => vi.unstubAllGlobals());

describe("ZXing photo fixtures #279", () => {
  it("committed fixtures match their manifest hashes", async () => {
    expect(manifest.fixtures.length).toBeGreaterThanOrEqual(2);
    for (const fixture of manifest.fixtures) {
      const { bytes } = await pixelsOf(fixture.file);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.sha256);
    }
  });

  it.each(manifest.fixtures.map((fixture) => [fixture.file, fixture] as const))(
    "refuses %s natively and reads it with the ZXing fallback",
    async (_file, fixture) => {
      const { pixels } = await pixelsOf(fixture.file);
      expect(() => readQrPixels(pixels)).toThrow("QR_DECODE_FAILED");
      fakeCanvasRuntime();
      const result = await readQrPixelsWithZxing(pixels);
      expect(result.payload).toBe(fixture.payload);
      expect(result.errorCorrection).toBe(fixture.errorCorrectionLevel);
      expect(result.mask).toBeNull();
      expect(result.errorCorrectionVerified).toBe(false);
      expect(result.byteLength).toBe(new TextEncoder().encode(fixture.payload).length);
    },
  );
});
