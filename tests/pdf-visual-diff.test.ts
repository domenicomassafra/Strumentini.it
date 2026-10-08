import { describe, expect, it } from "vitest";
import { comparePdfThumbnailPixels } from "../src/engines/pdf/visual-diff";

describe("PDF visual sample image comparison", () => {
  const white = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]);
  it("compares actual decoded pixels and highlights only changed positions", () => {
    expect(comparePdfThumbnailPixels({ width: 2, height: 1, rgba: white }, { width: 2, height: 1, rgba: white })).toMatchObject({ status: "sample-match", changedPixels: 0, totalPixels: 2 });
    const black = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    const diff = comparePdfThumbnailPixels({ width: 2, height: 1, rgba: white }, { width: 2, height: 1, rgba: black });
    expect(diff).toMatchObject({ status: "different", changedPixels: 1, totalPixels: 2 });
    expect([...diff.rgba!.slice(0, 4)]).toEqual([225, 35, 35, 255]);
  });
  it("never guesses pixel identity when render size or shape is unsupported", () => {
    expect(comparePdfThumbnailPixels({ width: 2, height: 1, rgba: white }, { width: 1, height: 2, rgba: white }).status).toBe("partial");
    expect(comparePdfThumbnailPixels({ width: 177, height: 1, rgba: white }, { width: 177, height: 1, rgba: white }).status).toBe("partial");
    expect(comparePdfThumbnailPixels({ width: 2, height: 1, rgba: new Uint8ClampedArray(0) }, { width: 2, height: 1, rgba: white }).status).toBe("partial");
  });
});
