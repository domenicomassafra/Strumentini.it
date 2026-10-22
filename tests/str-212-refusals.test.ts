import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { convertImageFormatLocal } from "../src/engines/image/visual-tools";
import { decodePortableImage } from "../src/engines/image/portable-decode";
import { gifFirstFrameToPng212 } from "../src/engines/image/directional-212";
import { reencodeAnimatedGif273 } from "../src/engines/image/gif-animation-273";

const fromFixture = (path: string) => new Uint8Array(readFileSync(new URL(path, import.meta.url)));
const avif = () => fromFixture("../quality/fixtures/image-format-matrix/source.avif");
const heic = () => fromFixture("../quality/fixtures/image-format-matrix/source.heic");
const animation = () => fromFixture("../spikes/heavy-local-feasibility/public/corpus/sample-animated.gif");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const file = (bytes: Uint8Array, name: string, type: string) => ({
  name, type, size: bytes.byteLength, blob: new Blob([new Uint8Array(bytes)], { type }),
});

describe("STR-212 refusals preserve original files", () => {
  it("refuses an AVIF file with a forged MIME/name before invoking any decoder or encoder", async () => {
    const bytes = Uint8Array.of(0x42, 0x4d, 0, 0, 0, 0, 0, 0);
    const original = new File([new Uint8Array(bytes)], "not-an-image.avif", { type: "image/avif" });
    const before = hash(new Uint8Array(await original.arrayBuffer()));
    const decoder = vi.fn();
    vi.stubGlobal("createImageBitmap", decoder);
    try {
      await expect(convertImageFormatLocal({ file: original, mime: "image/png" }))
        .rejects.toThrow(/UNSUPPORTED_TYPE/);
      expect(decoder).not.toHaveBeenCalled();
      expect(hash(new Uint8Array(await original.arrayBuffer()))).toBe(before);
      expect(hash(bytes)).toBe(before);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refuses timed AVIF and HEIC sequences without rewriting input bytes", async () => {
    for (const [source, brand, name, type, expected] of [
      [avif(), "avis", "sequence.avif", "image/avif", /UNSUPPORTED_AVIF_SEQUENCE/],
      [heic(), "hevc", "sequence.heic", "image/heic", /UNSUPPORTED_HEIC_SEQUENCE/],
    ] as const) {
      const changed = source.slice();
      changed.set(new TextEncoder().encode(brand), 8);
      const original = file(changed, name, type);
      const before = hash(new Uint8Array(await original.blob.arrayBuffer()));
      await expect(decodePortableImage(original)).rejects.toThrow(expected);
      expect(hash(new Uint8Array(await original.blob.arrayBuffer()))).toBe(before);
      expect(hash(changed)).toBe(before);
      expect(hash(source)).not.toBe(before);
    }
  });

  it("leaves animated GIF intact when still-frame loss is not acknowledged", async () => {
    const bytes = animation();
    const original = new Blob([bytes], { type: "image/gif" });
    const before = hash(new Uint8Array(await original.arrayBuffer()));
    await expect(gifFirstFrameToPng212(original)).rejects.toThrow(/ANIMATION_LOSS_NOT_ACKNOWLEDGED/);
    expect(hash(new Uint8Array(await original.arrayBuffer()))).toBe(before);
    expect(hash(bytes)).toBe(before);
  });

  it("does not emit an animated GIF for a truncated source, or change the original", async () => {
    const bytes = animation().subarray(0, animation().length - 1);
    const original = new Blob([bytes], { type: "image/gif" });
    const before = hash(new Uint8Array(await original.arrayBuffer()));
    await expect(reencodeAnimatedGif273(original)).rejects.toThrow(/GIF/);
    expect(hash(new Uint8Array(await original.arrayBuffer()))).toBe(before);
  });

  it("keeps HEIC untouched when native decode is absent; no forbidden LGPL fallback", async () => {
    const bytes = heic();
    const original = file(bytes, "sample.heic", "image/heic");
    const before = hash(new Uint8Array(await original.blob.arrayBuffer()));
    const old = globalThis.createImageBitmap;
    vi.stubGlobal("createImageBitmap", undefined);
    try {
      await expect(decodePortableImage(original)).rejects.toThrow(/UNSUPPORTED_BROWSER/);
      expect(hash(new Uint8Array(await original.blob.arrayBuffer()))).toBe(before);
    } finally {
      vi.stubGlobal("createImageBitmap", old);
      vi.unstubAllGlobals();
    }
  });
});
