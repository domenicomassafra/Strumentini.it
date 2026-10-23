import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resizeImageLocal } from "../src/tools/image-resize/module";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("STR-278 — refused inputs preserve the original", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { description: "wrong format", file: new Uint8Array([1, 2, 3, 4]), code: "UNSUPPORTED_TYPE" },
    { description: "truncated PNG", file: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), code: "TRUNCATED_IMAGE" },
  ])("refuses $description before attempting to decode", async ({ file, code }) => {
    vi.stubGlobal("document", { createElement: vi.fn() });
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const original = digest(file);
    const blob = new Blob([file], { type: "image/png" });
    await expect(resizeImageLocal({ file: blob, width: 100, height: 100,
      fit: "contain", outputMime: "image/jpeg", quality: 0.88 })).rejects.toThrow(code);
    expect(digest(new Uint8Array(await blob.arrayBuffer()))).toBe(original);
    expect(decode).not.toHaveBeenCalled();
  });

  it("refuses a browser missing image APIs without touching the input", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const original = new Uint8Array([13, 37, 42]);
    const blob = new Blob([original]);
    await expect(resizeImageLocal({ file: blob, width: 5, height: 5, fit: "contain",
      outputMime: "image/jpeg", quality: 0.88 })).rejects.toThrow("UNSUPPORTED_BROWSER");
    expect(digest(new Uint8Array(await blob.arrayBuffer()))).toBe(digest(original));
  });
});
