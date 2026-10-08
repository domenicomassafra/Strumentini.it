import { describe, expect, it } from "vitest";
import { isSvgInput, validateSvgOptions } from "../src/engines/image/svg-export";

const options = { mime: "image/png" as const, width: 160, height: 120, scale: 1, background: "transparent" };

describe("313 — SVG export contract and bounded choices", () => {
  it("recognizes only an SVG filename or declared SVG MIME", () => {
    expect(isSvgInput({ name: "drawing.svg", type: "" })).toBe(true);
    expect(isSvgInput({ name: "drawing.txt", type: "image/svg+xml" })).toBe(true);
    expect(isSvgInput({ name: "drawing.png", type: "image/png" })).toBe(false);
    expect(isSvgInput({ name: "bad.svg.exe", type: "" })).toBe(false);
    expect(isSvgInput(null)).toBe(false);
  });

  it("uses explicit scaled dimensions and validates output pixel budgets", () => {
    expect(validateSvgOptions({ ...options, scale: 2 })).toMatchObject({ width: 320, height: 240, background: "transparent" });
    expect(validateSvgOptions({ ...options, width: 200, height: 100, scale: 0.5 })).toMatchObject({ width: 100, height: 50 });
    expect(() => validateSvgOptions({ ...options, width: 8192, height: 8192 })).toThrow(/PIXEL_LIMIT/u);
    for (const scale of [0, -1, 0.09, 4.1, NaN, Infinity]) {
      expect(() => validateSvgOptions({ ...options, scale })).toThrow(/INVALID_INPUT/u);
    }
    for (const width of [0, -1, 1.5, Infinity]) {
      expect(() => validateSvgOptions({ ...options, width })).toThrow(/INVALID_INPUT/u);
    }
  });

  it("requires an opaque, explicitly chosen color for JPEG and raster-backed PDF", () => {
    for (const mime of ["image/jpeg", "application/pdf"] as const) {
      expect(() => validateSvgOptions({ ...options, mime })).toThrow(/INVALID_INPUT/u);
      expect(validateSvgOptions({ ...options, mime, background: "#0000ff" }).background).toBe("#0000ff");
    }
    expect(() => validateSvgOptions({ ...options, background: "url(https://host/image)" })).toThrow(/INVALID_INPUT/u);
    expect(() => validateSvgOptions({ ...options, background: "transparent", mime: "image/webp" })).not.toThrow();
  });
});
