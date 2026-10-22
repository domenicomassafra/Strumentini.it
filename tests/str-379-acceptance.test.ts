import { describe, expect, it } from "vitest";
import {
  createPdfProjectHistory138, recordPdfProjectEdit138, stepPdfProjectHistory138,
  validatePdfProjectHistory138,
} from "../src/engines/pdf/project-history-138";

describe("STR-379 PDF project acceptance", () => {
  it("restores a saved snapshot with undo and redo across reorder, selection and mode", () => {
    const original = createPdfProjectHistory138(4);
    const reordered = recordPdfProjectEdit138(original,
      { order: [4, 3, 2, 1], selected: [], mode: "reorder" }, 4);
    const selected = recordPdfProjectEdit138(reordered,
      { order: [4, 3, 2, 1], selected: [4], mode: "selected" }, 4);
    const serialized = JSON.stringify(selected);
    const restored = JSON.parse(serialized);
    expect(validatePdfProjectHistory138(restored, 4)).toBe(true);
    expect(restored).toEqual(selected);
    const undo = stepPdfProjectHistory138(restored, -1);
    expect(undo.states[undo.index]).toEqual(reordered.states[reordered.index]);
    const redo = stepPdfProjectHistory138(undo, 1);
    expect(redo.states[redo.index]).toEqual(selected.states[selected.index]);
    expect(stepPdfProjectHistory138(stepPdfProjectHistory138(undo, -1), -1).index).toBe(0);
    expect(redo.states[0]).toEqual(original.states[0]);
  });

  it("retains the original and only the chosen branch after editing an undone state", () => {
    const original = createPdfProjectHistory138(3);
    const flipped = recordPdfProjectEdit138(original,
      { order: [3, 2, 1], selected: [], mode: "reorder" }, 3);
    const picked = recordPdfProjectEdit138(flipped,
      { order: [3, 2, 1], selected: [1], mode: "selected" }, 3);
    const branched = recordPdfProjectEdit138(stepPdfProjectHistory138(picked, -1),
      { order: [2, 3, 1], selected: [], mode: "reorder" }, 3);
    expect(branched.states).toHaveLength(3);
    expect(branched.states[0]).toEqual(original.states[0]);
    expect(branched.states[2]?.order).toEqual([2, 3, 1]);
    expect(stepPdfProjectHistory138(branched, 1)).toBe(branched);
  });
});
