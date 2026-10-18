/** #212: a refused AVIF decode must release its native ImageBitmap. */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodePortableImage } from "../src/engines/image/portable-decode";

const source = Uint8Array.from(readFileSync(new URL("../quality/fixtures/image-format-matrix/source.avif", import.meta.url)));
const file = () => ({
  name: "source.avif", type: "image/avif", size: source.length,
  blob: new Blob([new Uint8Array(source)], { type: "image/avif" }),
});

afterEach(() => vi.unstubAllGlobals());

describe("#212 native AVIF decode cleanup on refusal", () => {
  it.each([
    ["surface beyond 16 million pixels", 4_001, 4_000],
    ["width beyond 8192", 8_193, 1],
  ])("closes an already decoded bitmap when refusing %s", async (_name, width, height) => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width, height, close })));
    await expect(decodePortableImage(file())).rejects.toThrow(/PIXEL_LIMIT/);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes a bitmap if cancellation arrives during native AVIF decode", async () => {
    const controller = new AbortController();
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      controller.abort();
      return { width: 2, height: 2, close };
    }));
    await expect(decodePortableImage(file(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps ownership of a valid decoded bitmap with its caller", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2, height: 2, close })));
    const decoded = await decodePortableImage(file());
    expect(decoded).toMatchObject({ kind: "avif", width: 2, height: 2, framePolicy: "single-image" });
    expect(close).not.toHaveBeenCalled();
    decoded.bitmap.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
