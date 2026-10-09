import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { gifFirstFrameToPng212, probeAvifDecode212, probeHeicDecode212 } from "../src/engines/image/directional-212";

const still = (): Uint8Array => new Uint8Array(readFileSync(new URL("../quality/fixtures/image-format-matrix/source.gif", import.meta.url)));
const animated = (): Uint8Array => new Uint8Array(readFileSync(new URL("../spikes/heavy-local-feasibility/public/corpus/sample-animated.gif", import.meta.url)));
const avif = (): Uint8Array => new Uint8Array(readFileSync(new URL("../quality/fixtures/image-format-matrix/source.avif", import.meta.url)));
const blob = (bytes: Uint8Array): Blob => new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" });
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

describe("#212 isolated directional GIF first-frame conversion and AVIF/HEIC fail-closed probes", () => {
  it("creates a real signed PNG from the transparent still GIF without an animation loss flag", async () => {
    const source = still();
    const result = await gifFirstFrameToPng212(blob(source));
    expect(result).toMatchObject({
      width: 2, height: 2, frameCount: 1, frameDelaysCentiseconds: [0],
      animationDiscarded: false, framePolicy: "first-frame-only",
      transparentFrameCount: 1,
      inputBytes: source.length, outputBytes: result.png.length,
    });
    expect(Array.from(result.png.subarray(0, 8))).toEqual(pngSignature);
    expect(new TextDecoder().decode(result.png.subarray(12, 16))).toBe("IHDR");
    expect(result.png.length).toBeGreaterThan(50);
  });

  it("requires explicit animation-loss approval, and then preserves original GIF timing facts", async () => {
    const source = animated();
    await expect(gifFirstFrameToPng212(blob(source))).rejects.toThrow(/ANIMATION_LOSS_NOT_ACKNOWLEDGED/);
    const result = await gifFirstFrameToPng212(blob(source), { allowAnimationLoss: true });
    expect(result).toMatchObject({
      width: 64, height: 64, frameCount: 4, frameDelaysCentiseconds: [25, 25, 25, 25],
      totalDelayCentiseconds: 100, transparentFrameCount: 3, disposalMethods: [1, 1, 1, 1],
      animationDiscarded: true, framePolicy: "first-frame-only",
    });
    expect(result.lossNote).toMatch(/Only frame 1 exported/);
    expect(result.lossNote).toMatch(/loop\/disposal behavior are lost/);
    expect(Array.from(result.png.subarray(0, 8))).toEqual(pngSignature);
  });

  it("refuses malformed LZW, unsupported first-frame geometry and corrupt GIF before output", async () => {
    const source = still();
    const invalid = source.slice();
    invalid[0] = 0;
    await expect(gifFirstFrameToPng212(blob(invalid))).rejects.toThrow(/INVALID_GIF/);
    const truncated = source.subarray(0, source.length - 1);
    await expect(gifFirstFrameToPng212(blob(truncated))).rejects.toThrow(/INVALID_GIF/);
    const oversized = new Uint8Array(4 * 1024 * 1024 + 1);
    await expect(gifFirstFrameToPng212(blob(oversized))).rejects.toThrow(/GIF_LIMIT/);
    const imageAt = source.indexOf(0x2c, 30);
    expect(imageAt).toBeGreaterThan(0);
    const unsupported = source.slice();
    unsupported[imageAt + 1] = 1; // frame shifted 1 px, outside source canvas.
    await expect(gifFirstFrameToPng212(blob(unsupported))).rejects.toThrow(/INVALID_GIF|UNSUPPORTED_GIF_FRAME/);
    const invalidLzw = source.slice();
    // The first image descriptor ends 10 bytes after the image separator.
    invalidLzw[imageAt + 10] = 9; // min code bits outside 2..8.
    await expect(gifFirstFrameToPng212(blob(invalidLzw))).rejects.toThrow(/INVALID_GIF|INVALID_GIF_LZW/);
  });

  it("respects cancellation without leaking an output", async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(gifFirstFrameToPng212(blob(animated()), { allowAnimationLoss: true, signal: abort.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
    await expect(probeAvifDecode212(blob(avif()), abort.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });

  it("checks AVIF BMFF bytes rather than extensions or MIME and refuses if no native decoder", async () => {
    const probe = await probeAvifDecode212(blob(avif()));
    // Node/Vitest has no native createImageBitmap: a desktop capability report must refuse.
    expect(probe).toMatchObject({ format: "avif", runtimeDecodeSupported: false, productionApproved: false });
    const mislabeled = new Blob([new Uint8Array(still())], { type: "image/avif" });
    expect(await probeAvifDecode212(mislabeled)).toMatchObject({
      runtimeDecodeSupported: false, productionApproved: false, reason: expect.stringContaining("ftyp"),
    });
    expect(await probeAvifDecode212(new Blob())).toMatchObject({ runtimeDecodeSupported: false, productionApproved: false });
    const imageSequence = avif().slice();
    imageSequence.set(new TextEncoder().encode("avis"), 8);
    expect(await probeAvifDecode212(blob(imageSequence))).toMatchObject({
      runtimeDecodeSupported: false, productionApproved: false,
      reason: expect.stringContaining("sequence unsupported"),
    });
  });

  it("verifies successful runtime probe contract only with injected fake decoder; does not promote production", async () => {
    let closed = false;
    vi.stubGlobal("createImageBitmap", async () => ({ width: 2, height: 2, close: () => { closed = true; } }));
    try {
      expect(await probeAvifDecode212(blob(avif()))).toMatchObject({
        format: "avif", runtimeDecodeSupported: true, productionApproved: false,
        decodedWidth: 2, decodedHeight: 2, reason: expect.stringContaining("NOT_RUN"),
      });
      expect(closed).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refuses HEIC uniformly including synthetic macOS fixture; does not claim iPhone provenance", () => {
    expect(probeHeicDecode212()).toMatchObject({
      format: "heic", runtimeDecodeSupported: false, productionApproved: false,
      reason: expect.stringContaining("real iPhone"),
    });
  });
});
