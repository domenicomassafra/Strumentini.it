import { describe, expect, it } from "vitest";
import { validateTextShapes384 } from "../src/engines/image/text-shapes-384";

const rectangle = { id: "bottom", type: "rectangle", x: 1, y: 2, width: 4, height: 3, fill: "#ff0000", opacity: 1, visible: true };
const text = { id: "top", type: "text", x: 2, y: 2, text: "Titolo", fontSize: 24, fontFamily: "sans-serif", direction: "ltr", fill: "#ffffff", opacity: 0.5, visible: true };

describe("STR-384 compositing contract", () => {
  it("preserves the user-selected bottom-to-top order, alpha and visibility without rewriting source layers", () => {
    const input = [rectangle, text, { ...rectangle, id: "hidden", type: "ellipse", opacity: 0, visible: false }];
    const snapshot = JSON.stringify(input);
    const layers = validateTextShapes384(input, 32, 32);
    expect(layers.map((layer) => [layer.id, layer.type, layer.opacity, layer.visible])).toEqual([
      ["bottom", "rectangle", 1, true], ["top", "text", 0.5, true], ["hidden", "ellipse", 0, false],
    ]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("retains shape geometry and text glyph input in bounded composition", () => {
    expect(validateTextShapes384([rectangle, text], 10, 10)).toMatchObject([rectangle, text]);
    expect(() => validateTextShapes384([{ ...rectangle, x: 9 }], 10, 10)).not.toThrow(); // native canvas clips at edge
    expect(() => validateTextShapes384([{ ...rectangle, x: 10 }], 10, 10)).toThrow(/Layer x/u);
    expect(() => validateTextShapes384([rectangle], 2000, 1001)).toThrow(/PIXEL_LIMIT/u);
  });
});
