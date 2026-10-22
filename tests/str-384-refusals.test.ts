import { describe, expect, it } from "vitest";
import { validateTextShapes384 } from "../src/engines/image/text-shapes-384";

const text = { id: "text1", type: "text", x: 0, y: 0, text: "Ok", fontSize: 18, fontFamily: "sans-serif", direction: "ltr", fill: "#000000", opacity: 1, visible: true };
const validate = (layers: unknown) => validateTextShapes384(layers, 80, 80);

describe("STR-384 explicit refusal and preservation policy", () => {
  it("refuses a missing/custom font instead of silently exporting fallback glyphs", () => {
    expect(() => validate([{ ...text, fontFamily: "DefinitelyMissingFont123" }])).toThrow(/MISSING_FONT/u);
  });

  it("refuses emoji and mixed RTL even in hidden layers", () => {
    expect(() => validate([{ ...text, text: "Ok 🦉", visible: false }])).toThrow(/UNSUPPORTED_EMOJI/u);
    expect(() => validate([{ ...text, text: "Hello مرحبا" }])).toThrow(/UNSUPPORTED_RTL/u);
    expect(() => validate([{ ...text, direction: "rtl" }])).toThrow(/UNSUPPORTED_RTL/u);
  });

  it("rejects invalid ids, nonfinite alpha, malformed size and unbounded layer stacks", () => {
    expect(() => validate([text, { ...text }])).toThrow(/unique/u);
    expect(() => validate([{ ...text, opacity: Number.NaN }])).toThrow(/Opacity/u);
    expect(() => validate([{ ...text, fontSize: -1 }])).toThrow(/Font size/u);
    expect(() => validate(Array.from({ length: 17 }, (_, i) => ({ ...text, id: `text${i}` })))).toThrow(/1 to 16/u);
  });
});
