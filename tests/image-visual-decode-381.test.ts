import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { decodeBitmap } from "../src/engines/image/visual";

const source = () => sharp({ create: { width: 1, height: 1, channels: 4, background: "red" } }).png().toBuffer();

afterEach(() => vi.unstubAllGlobals());

describe("STR-381 decoded ImageBitmap ownership", () => {
  it("closes a bitmap delivered after cancellation during native decoding", async () => {
    const controller = new AbortController();
    const close = vi.fn();
    let entered!: () => void;
    const decoding = new Promise<void>((resolve) => { entered = resolve; });
    let deliver!: (bitmap: ImageBitmap) => void;
    vi.stubGlobal("createImageBitmap", () => {
      entered();
      return new Promise<ImageBitmap>((resolve) => { deliver = resolve; });
    });

    const job = decodeBitmap(new Blob([await source()], { type: "image/png" }), controller.signal);
    await decoding;
    controller.abort();
    deliver({ width: 1, height: 1, close } as unknown as ImageBitmap);
    await expect(job).rejects.toMatchObject({ name: "AbortError" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes an unexpectedly oversized decoded bitmap before refusal", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 4001, height: 4000, close })));
    await expect(decodeBitmap(new Blob([await source()], { type: "image/png" }))).rejects.toThrow(/PIXEL_LIMIT/u);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
