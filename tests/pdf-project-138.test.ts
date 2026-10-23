import { describe, expect, it } from "vitest";
import {
  createPdfProjectHistory138, recordPdfProjectEdit138, stepPdfProjectHistory138,
  validatePdfProjectHistory138,
} from "../src/engines/pdf/project-history-138";

describe("#138 project history at the PDF workspace seam", () => {
  it("undoes, redoes and discards redo only after a new change", () => {
    const initial = createPdfProjectHistory138(3);
    const swapped = recordPdfProjectEdit138(initial, { order: [3, 2, 1], selected: [], mode: "reorder" }, 3);
    const picked = recordPdfProjectEdit138(swapped, { order: [3, 2, 1], selected: [2], mode: "selected" }, 3);
    const undo = stepPdfProjectHistory138(picked, -1);
    expect(undo.states[undo.index]).toEqual(swapped.states[swapped.index]);
    expect(stepPdfProjectHistory138(undo, 1)).toEqual(picked);
    const branched = recordPdfProjectEdit138(undo, { order: [2, 3, 1], selected: [], mode: "reorder" }, 3);
    expect(branched.states).toHaveLength(3);
    expect(stepPdfProjectHistory138(branched, 1)).toEqual(branched);
    expect(stepPdfProjectHistory138(initial, -1)).toEqual(initial);
  });

  it("retains the clean original as the first undo state when history is capped", () => {
    let history = createPdfProjectHistory138(2);
    for (let i = 0; i < 70; i++) {
      history = recordPdfProjectEdit138(history, {
        order: i % 2 === 0 ? [2, 1] : [1, 2], selected: [], mode: "reorder",
      }, 2);
    }
    expect(history.states).toHaveLength(40);
    expect(history.states[0]?.order).toEqual([1, 2]);
    expect(validatePdfProjectHistory138(history, 2)).toBe(true);
  });

  it("rejects future, damaged, duplicate and out-of-range persisted state", () => {
    const initial = createPdfProjectHistory138(2);
    expect(validatePdfProjectHistory138(initial, 2)).toBe(true);
    expect(validatePdfProjectHistory138({
      version: 1, index: 0, states: [{ order: [2, 1], selected: [], mode: "reorder" }],
    }, 2)).toBe(false);
    for (const bad of [
      { ...initial, version: 2 },
      { ...initial, index: 2 },
      { ...initial, states: [{ order: [1, 1], selected: [], mode: "reorder" }] },
      { ...initial, states: [{ order: [1, 2], selected: [3], mode: "selected" }] },
      { ...initial, states: [{ order: [1, 2], selected: [], mode: "future" }] },
    ]) expect(validatePdfProjectHistory138(bad, 2)).toBe(false);
    expect(() => recordPdfProjectEdit138(initial, { order: [1, 1], selected: [], mode: "reorder" }, 2)).toThrow();
  });
});
