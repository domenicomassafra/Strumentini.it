/** #212 wave23: GIF89a Graphic Control Extension scope across plain text.
 * Real checked-in GIF LZW/palette data are kept intact. Sharp and Pillow
 * independently decode first-frame pixels; the directional engine writes a
 * real PNG which is reopened, not a mocked conversion result.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { gifFirstFrameToPng212, probeAvifDecode212, probeHeicDecode212 } from "../src/engines/image/directional-212";
import { inspectGifStructure } from "../src/engines/image/gif-structure";

const still = (): Uint8Array => Uint8Array.from(readFileSync(new URL("../quality/fixtures/image-format-matrix/source.gif", import.meta.url)));
const animated = (): Uint8Array => Uint8Array.from(readFileSync(new URL("../spikes/heavy-local-feasibility/public/corpus/sample-animated.gif", import.meta.url)));
const originalAvif = (): Uint8Array => Uint8Array.from(readFileSync(new URL("../quality/fixtures/image-format-matrix/source.avif", import.meta.url)));
const asBlob = (source: Uint8Array): Blob => new Blob([new Uint8Array(source)], { type: "image/gif" });
const join = (...parts: Uint8Array[]): Uint8Array => {
  const merged = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let at = 0;
  for (const part of parts) { merged.set(part, at); at += part.length; }
  return merged;
};
const gif89a = (bytes: Uint8Array): Uint8Array => {
  const result = bytes.slice();
  result.set([71, 73, 70, 56, 57, 97]); // GIF89a; source fixture has GIF87a header despite GCE.
  return result;
};

function firstControlOffset(gif: Uint8Array): number {
  const offset = gif.findIndex((value, index) =>
    value === 0x21 && gif[index + 1] === 0xf9 && gif[index + 2] === 4 && gif[index + 7] === 0);
  if (offset < 0) throw new Error("Fixture must contain a real GIF Graphic Control Extension");
  return offset;
}

// A genuine GIF89a Plain Text Extension: 12-byte grid header (0,0,2,2),
// 1x1 cell, palette indices 1/0; one ASCII 'A' data byte and sub-block end.
const plainText = Uint8Array.of(
  0x21, 0x01, 0x0c, 0, 0, 0, 0, 2, 0, 2, 0, 1, 1, 1, 0,
  1, 0x41, 0,
);
const comment = Uint8Array.of(0x21, 0xfe, 3, 65, 66, 67, 0);

function afterFirstGce(gif: Uint8Array, extension: Uint8Array): Uint8Array {
  const at = firstControlOffset(gif);
  expect([...gif.subarray(at, at + 8)]).toEqual([0x21, 0xf9, 4, 0x09, 0, 0, 4, 0]);
  return join(gif.subarray(0, at + 8), extension, gif.subarray(at + 8));
}
function withoutFirstGce(gif: Uint8Array): Uint8Array {
  const at = firstControlOffset(gif);
  return join(gif.subarray(0, at), gif.subarray(at + 8));
}
const decodeRgbaSharp = (source: Uint8Array): Promise<Buffer> =>
  sharp(Buffer.from(source)).ensureAlpha().raw().toBuffer();

const pillowPresent = spawnSync("python3", ["-c", "from PIL import Image"], { encoding: "utf8" }).status === 0;
function decodeRgbaPillow(source: Uint8Array): Buffer {
  const python = [
    "import io,sys",
    "from PIL import Image",
    "with Image.open(io.BytesIO(sys.stdin.buffer.read())) as pic:",
    "  sys.stdout.buffer.write(pic.convert('RGBA').tobytes())",
  ].join("\n");
  const completed = spawnSync("python3", ["-c", python], {
    input: Buffer.from(source), encoding: "buffer", maxBuffer: 4 * 1024 * 1024, timeout: 6_000,
  });
  expect(completed.status, Buffer.from(completed.stderr).toString()).toBe(0);
  return completed.stdout;
}

describe("#212 wave23 first-image GCE semantics and real PNG fidelity", () => {
  it("consumes pending GCE transparency on a real GIF89a plain-text rendering block BEFORE frame 1", async () => {
    const base = gif89a(still());
    const textBeforeImage = afterFirstGce(base, plainText);
    const opaqueBaseline = withoutFirstGce(base);
    expect(inspectGifStructure(textBeforeImage)).toMatchObject({
      frameCount: 1, animated: false, transparentFrameCount: 0, frameDelaysCentiseconds: [0], disposalMethods: [0],
    });
    const opaqueSharp = await decodeRgbaSharp(opaqueBaseline);
    const normalSharp = await decodeRgbaSharp(base);
    expect(opaqueSharp).not.toEqual(normalSharp); // The GCE transparency actually matters.
    expect([...opaqueSharp.subarray(4, 8)]).toEqual([0, 0, 0, 255]); // Palette entry visible instead of alpha zero.
    const exported = await gifFirstFrameToPng212(asBlob(textBeforeImage));
    expect(exported).toMatchObject({
      frameCount: 1, transparentFrameCount: 0, animationDiscarded: false,
      frameDelaysCentiseconds: [0], framePolicy: "first-frame-only", width: 2, height: 2,
    });
    expect([...exported.png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const reopened = await decodeRgbaSharp(exported.png);
    expect(reopened).toEqual(opaqueSharp); // RED: stale GCE previously leaves alpha 0.
    if (pillowPresent) {
      expect(decodeRgbaPillow(exported.png)).toEqual(decodeRgbaPillow(opaqueBaseline));
      expect(decodeRgbaPillow(exported.png)).toEqual(reopened);
    }
  }, 20_000); // Two independent Pillow subprocesses can contend with global CI.

  it("preserves pending first-frame GCE across a comment extension, and respects a newly assigned GCE after plain text", async () => {
    const base = gif89a(still());
    const commentGif = afterFirstGce(base, comment);
    expect(inspectGifStructure(commentGif).transparentFrameCount).toBe(1);
    const commentOutput = await gifFirstFrameToPng212(asBlob(commentGif));
    expect(await decodeRgbaSharp(commentOutput.png)).toEqual(await decodeRgbaSharp(base));

    const plainThenControl = afterFirstGce(base, join(plainText, base.subarray(firstControlOffset(base), firstControlOffset(base) + 8)));
    expect(inspectGifStructure(plainThenControl).transparentFrameCount).toBe(1);
    const reinstated = await gifFirstFrameToPng212(asBlob(plainThenControl));
    expect(await decodeRgbaSharp(reinstated.png)).toEqual(await decodeRgbaSharp(base));
    if (pillowPresent) {
      expect(decodeRgbaPillow(commentOutput.png)).toEqual(decodeRgbaPillow(base));
      expect(decodeRgbaPillow(reinstated.png)).toEqual(decodeRgbaPillow(base));
    }
  }, 20_000);

  it("refuses opaque partial first frame after plain text consumes its GCE instead of silently inventing transparency", async () => {
    const base = gif89a(still());
    const shifted = base.slice();
    shifted.set([4, 0, 3, 0], 6);
    const firstImage = shifted.indexOf(0x2c, firstControlOffset(shifted) + 8);
    expect(firstImage).toBeGreaterThan(0);
    shifted.set([1, 0, 1, 0], firstImage + 1);
    const textBeforePartialImage = afterFirstGce(shifted, plainText);
    expect(inspectGifStructure(textBeforePartialImage)).toMatchObject({
      width: 4, height: 3, transparentFrameCount: 0,
    });
    await expect(gifFirstFrameToPng212(asBlob(textBeforePartialImage)))
      .rejects.toThrow(/UNSUPPORTED_GIF_FRAME/);
  });

  it("preserves explicit animated first-frame loss consent and refuses unsupported HEIC/AVIF production promotion", async () => {
    const source = animated();
    await expect(gifFirstFrameToPng212(asBlob(source))).rejects.toThrow(/ANIMATION_LOSS_NOT_ACKNOWLEDGED/);
    const approved = await gifFirstFrameToPng212(asBlob(source), { allowAnimationLoss: true });
    expect(approved.animationDiscarded).toBe(true);
    expect(approved.frameDelaysCentiseconds).toEqual([25, 25, 25, 25]);
    expect(await decodeRgbaSharp(approved.png)).toEqual(await decodeRgbaSharp(source));
    expect(probeHeicDecode212()).toMatchObject({ format: "heic", runtimeDecodeSupported: false, productionApproved: false });
    const nativeAvif = await probeAvifDecode212(new Blob([new Uint8Array(originalAvif())], { type: "image/avif" }));
    expect(nativeAvif).toMatchObject({ format: "avif", productionApproved: false });
  });

  it("cancels before reading real GIF bytes and rejects oversized blobs", async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(gifFirstFrameToPng212(asBlob(still()), { signal: abort.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
    await expect(gifFirstFrameToPng212(new Blob([new Uint8Array(4 * 1024 * 1024 + 1)])))
      .rejects.toThrow(/GIF_LIMIT/);
  });

  // Opt-in real-browser proof: STRUMENTINI_212_BROWSER_PROOF=1 npx vitest run
  // tests/image-directional-212-wave23.test.ts. Default unit/CI runners may
  // install Playwright JS without a Chromium executable.
  it.skipIf(process.env.STRUMENTINI_212_BROWSER_PROOF !== "1")(
    "reopens the newly corrected still PNG in real Chromium with exact RGBA and no network",
    async () => {
      const source = afterFirstGce(gif89a(still()), plainText);
      const expected = await decodeRgbaSharp(withoutFirstGce(gif89a(still())));
      const bundle = await build({
        entryPoints: [new URL("../src/engines/image/directional-212.ts", import.meta.url).pathname],
        bundle: true, write: false, platform: "browser", format: "iife", globalName: "Directional212Wave23",
      });
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const requests: string[] = [];
        page.on("request", (request) => requests.push(request.url()));
        await page.goto("about:blank");
        await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
        const observed = await page.evaluate(async (bytes) => {
          const engine = (window as typeof window & { Directional212Wave23: {
            gifFirstFrameToPng212: (data: Blob) => Promise<{ png: Uint8Array; transparentFrameCount: number }>;
          } }).Directional212Wave23;
          const result = await engine.gifFirstFrameToPng212(new Blob([new Uint8Array(bytes)], { type: "image/gif" }));
          const bitmap = await createImageBitmap(new Blob([new Uint8Array(result.png)], { type: "image/png" }));
          try {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d");
            if (context === null) throw new Error("Chromium 2D canvas not available");
            context.drawImage(bitmap, 0, 0);
            return {
              rgba: [...context.getImageData(0, 0, bitmap.width, bitmap.height).data],
              width: bitmap.width, height: bitmap.height, transparentFrameCount: result.transparentFrameCount,
            };
          } finally { bitmap.close(); }
        }, [...source]);
        expect(observed).toMatchObject({ width: 2, height: 2, transparentFrameCount: 0 });
        expect(Buffer.from(observed.rgba)).toEqual(expected);
        expect(requests).toEqual([]);
      } finally {
        await browser.close();
      }
    },
  );
});
