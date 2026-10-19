import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkPortraitInput, checkPortraitPng, PORTRAIT_MAX_FILE_BYTES } from "../src/engines/image/portrait-modnet-274";
import { PORTRAIT_MODEL_SHA256 } from "../src/engines/image/portrait-modnet-274";

const root = resolve(import.meta.dirname, "..");
function digest(path: string): string {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

describe("#274 portrait matting resource and PNG boundaries", () => {
  it("pins every distributed model file, original license and the two runtime asset bytes", () => {
    expect(digest("public/models/portrait-modnet/onnx/model_quantized.onnx")).toBe(PORTRAIT_MODEL_SHA256);
    expect(digest("public/models/portrait-modnet/config.json")).toBe("e144d8af9b1f09649785c77f592a76bbc69504ae02e43700663b2a9f00d9c8a2");
    expect(digest("public/models/portrait-modnet/preprocessor_config.json")).toBe("07d83634b1fdd20142ca6e3fe55ab92b558f56d1b0f005ff3a7926f1c9e1165d");
    expect(digest("public/models/portrait-modnet/LICENSE")).toBe("c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4");
    expect(digest("public/vendor/portrait-modnet/LICENSE-onnxruntime.txt")).toBe("2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c");
    expect(digest("node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm")).toBe("06ba057753da3847e4c24f02d91ab133455b0817c69a44993a9a53a2146df9e3");
    expect(digest("node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs")).toBe("c57ca56328877353a575e51bbca6f18450027d6c9bf2307a2cb2c41363b4de9f");
    const locked = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
    expect(locked.packages["node_modules/onnxruntime-web"].version).toBe("1.31.0-dev.20260914-8d85527a0");
    expect(locked.packages["node_modules/@huggingface/transformers"].version).toBe("4.3.1");
  });
  it("refuses dimensions over the memory budget and devices explicitly reporting low RAM", () => {
    expect(() => checkPortraitInput(100, 1024, 768, 8)).not.toThrow();
    expect(() => checkPortraitInput(PORTRAIT_MAX_FILE_BYTES + 1, 400, 400)).toThrow("FILE_SIZE_LIMIT");
    expect(() => checkPortraitInput(100, 1600, 1600)).toThrow("PIXEL_LIMIT");
    expect(() => checkPortraitInput(100, 800, 800, 2)).toThrow("MEMORY_LIMIT");
    expect(() => checkPortraitInput(100, NaN, 400)).toThrow("PIXEL_LIMIT");
  });

  it("refuses altered/missing PNG signature, wrong dimensions and opaque PNG output", () => {
    const png = new Uint8Array(48);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const h = new DataView(png.buffer);
    h.setUint32(8, 13); h.setUint32(12, 0x49484452); h.setUint32(16, 7); h.setUint32(20, 9); png[25] = 6;
    expect(() => checkPortraitPng(png, 7, 9)).not.toThrow();
    expect(() => checkPortraitPng(png, 8, 9)).toThrow("PNG_INVALID");
    png[25] = 2;
    expect(() => checkPortraitPng(png, 7, 9)).toThrow("PNG_INVALID");
    png[25] = 6;
    png[0] = 0;
    expect(() => checkPortraitPng(png, 7, 9)).toThrow("PNG_INVALID");
  });
});
