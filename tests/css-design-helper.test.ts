import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as cssTree from "css-tree";
import { buildCssDesign, type CssDesignInput } from "../src/engines/design-css";

const fixtures = JSON.parse(readFileSync(new URL("../quality/fixtures/css-design-helper/vectors.json", import.meta.url), "utf8")) as {
  vectors: Array<{ input: CssDesignInput; css: string }>;
};

describe("CSS design helper", () => {
  it.each(fixtures.vectors)("builds standards-parseable canonical CSS %#", ({ input, css }) => {
    const result = buildCssDesign(input);
    expect(result.css).toBe(css);
    expect(() => cssTree.parse(`.preview{${result.css}}`, { context: "stylesheet" })).not.toThrow();
    expect(result.value).toBe(result.css.slice(result.css.indexOf(":") + 1, -1).trim());
  });

  it("rejects invalid combinations at their field boundary", () => {
    expect(() => buildCssDesign({ mode: "gradient", angle: 361, startColor: "#000", endColor: "#fff" })).toThrow("INVALID_ANGLE");
    expect(() => buildCssDesign({ mode: "shadow", offsetX: 0, offsetY: 0, blur: -1, spread: 0, color: "#000" })).toThrow("INVALID_BLUR");
    expect(() => buildCssDesign({ mode: "radius", topLeft: -1, topRight: 0, bottomRight: 0, bottomLeft: 0 })).toThrow("INVALID_TOP_LEFT");
    expect(() => buildCssDesign({ mode: "gradient", angle: 90, startColor: "red", endColor: "#fff" })).toThrow("INVALID_START_COLOR");
  });
});
