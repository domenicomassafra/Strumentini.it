import { describe, expect, it } from "vitest";
import { moveSelection382, pointerPixel382, selectImagePixels382, selectionFromDrag382 } from "../src/engines/image/selection-mask-382";

const frame = { width: 3, height: 2, data: new Uint8ClampedArray(24).fill(128) };

describe("STR-382 input safety and keyboard/touch equivalence", () => {
  it("maps a touch drag to pixel boundaries and a keyboard translation to the same selection", () => {
    const bounds = { left: 50, top: 70, width: 300, height: 200 };
    const start = pointerPixel382(51, 71, bounds, 3, 2);
    const end = pointerPixel382(249, 171, bounds, 3, 2);
    const touch = selectionFromDrag382(start, end, 3, 2, "rectangle");
    expect(touch).toEqual({ x: 0, y: 0, width: 2, height: 2, shape: "rectangle" });
    const moved = moveSelection382({ x: 0, y: 0, width: 2, height: 2, shape: "rectangle" }, 1, 0, 3, 2);
    const pointerMoved = selectionFromDrag382(pointerPixel382(151, 71, bounds, 3, 2), pointerPixel382(349, 171, bounds, 3, 2), 3, 2, "rectangle");
    expect(moved).toEqual(pointerMoved);
    expect(moveSelection382(moved, 10, -10, 3, 2)).toEqual(moved);
  });

  it("clips pointer positions, but refuses nonfinite or absent canvas dimensions", () => {
    expect(pointerPixel382(-100, 999, { left: 0, top: 0, width: 300, height: 200 }, 3, 2)).toEqual({ x: 0, y: 1 });
    expect(() => pointerPixel382(NaN, 4, { left: 0, top: 0, width: 300, height: 200 }, 3, 2)).toThrow(/INVALID_INPUT/u);
    expect(() => pointerPixel382(1, 2, { left: 0, top: 0, width: 0, height: 200 }, 3, 2)).toThrow(/INVALID_INPUT/u);
  });

  it("rejects malformed geometry, invalid coverage and impossible pixel budgets before producing output", () => {
    const valid = { x: 0, y: 0, width: 2, height: 1, shape: "rectangle" as const };
    expect(() => selectImagePixels382(frame, { ...valid, x: -1 })).toThrow(/INVALID_INPUT/u);
    expect(() => selectImagePixels382(frame, { ...valid, x: 2 })).toThrow(/INVALID_INPUT/u);
    expect(() => selectImagePixels382(frame, { ...valid, width: 0 })).toThrow(/INVALID_INPUT/u);
    expect(() => selectImagePixels382(frame, { ...valid, x: NaN })).toThrow(/INVALID_INPUT/u);
    expect(() => selectImagePixels382(frame, { ...valid, coverage: new Uint8ClampedArray(1) })).toThrow(/INVALID_INPUT/u);
    expect(() => selectImagePixels382({ ...frame, data: new Uint8ClampedArray(4) }, valid)).toThrow(/INVALID_INPUT/u);
    expect(() => selectImagePixels382({ width: 3000, height: 3000, data: new Uint8ClampedArray(0) }, valid)).toThrow(/PIXEL_LIMIT/u);
  });

  it("refuses cancellation without touching the original buffer", () => {
    const before = frame.data.slice();
    const controller = new AbortController();
    controller.abort();
    expect(() => selectImagePixels382(frame, { x: 0, y: 0, width: 3, height: 2, shape: "rectangle" }, "crop", controller.signal)).toThrow(/AbortError|cancelled/u);
    expect(frame.data).toEqual(before);
  });
});
