import { describe, expect, it } from "vitest";
import {
  commitImageProject385,
  createImageProjectHistory385,
  redoImageProject385,
  resetImageProject385,
  undoImageProject385,
} from "../src/engines/image/project-history-385";
import { applyImageTransformPixels, defaultImageTransformState } from "../src/engines/image/transform-workspace";

describe("STR-385 history and flattened pixel export", () => {
  const original = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 128]);

  it("undoes and redoes exact edits, drops redo after a new edit, and preserves source", () => {
    const initial = defaultImageTransformState(2, 1);
    let history = createImageProjectHistory385(initial);
    history = commitImageProject385(history, { ...initial, rotate: 180 });
    history = commitImageProject385(history, { ...history.current, flipHorizontal: true });
    const edited = [...applyImageTransformPixels({ width: 2, height: 1, data: original }, history.current).data];
    history = undoImageProject385(history);
    expect(history.current.flipHorizontal).toBe(false);
    history = redoImageProject385(history);
    expect([...applyImageTransformPixels({ width: 2, height: 1, data: original }, history.current).data]).toEqual(edited);
    history = undoImageProject385(history);
    history = commitImageProject385(history, { ...history.current, brightness: 10 });
    expect(redoImageProject385(history)).toBe(history);
    expect(Array.from(original)).toEqual([255, 0, 0, 255, 0, 0, 255, 128]);
    expect(resetImageProject385(history).current).toEqual(initial);
  });

  it("bounds undo/redo history under repeated operations", () => {
    let history = createImageProjectHistory385(defaultImageTransformState(1, 1));
    for (let i = 0; i < 80; i++) history = commitImageProject385(history, { ...history.current, brightness: i % 2 });
    expect(history.past).toHaveLength(64);
    for (let i = 0; i < 80; i++) history = undoImageProject385(history);
    expect(history.future).toHaveLength(64);
    for (let i = 0; i < 80; i++) history = redoImageProject385(history);
    expect(history.future).toHaveLength(0);
  });
});
