import { describe, expect, it } from "vitest";
import {
  createPdfProjectHistory138, recordPdfProjectEdit138,
  validatePdfProjectHistory138,
} from "../src/engines/pdf/project-history-138";

describe("STR-379 PDF project refusals", () => {
  it("rejects unsupported history versions and corrupt edits while preserving source state", () => {
    const source = createPdfProjectHistory138(3);
    const snapshot = structuredClone(source);
    const bad = [
      { ...source, version: 2 },
      { ...source, index: 5 },
      { ...source, states: [{ order: [1, 1, 3], selected: [], mode: "reorder" }] },
      { ...source, states: [{ order: [1, 2, 3], selected: [4], mode: "selected" }] },
      { ...source, states: [{ order: [1, 2, 3], selected: [], mode: "unknown" }] },
      { ...source, states: [] },
    ];
    for (const record of bad) expect(validatePdfProjectHistory138(record, 3)).toBe(false);
    expect(source).toEqual(snapshot);
    expect(validatePdfProjectHistory138(source, 3)).toBe(true);
  });

  it("refuses invalid edits without damaging a valid undo history", () => {
    const source = recordPdfProjectEdit138(createPdfProjectHistory138(3),
      { order: [3, 2, 1], selected: [], mode: "reorder" }, 3);
    const snapshot = structuredClone(source);
    expect(() => recordPdfProjectEdit138(source,
      { order: [1, 2, 2], selected: [], mode: "reorder" }, 3)).toThrow();
    expect(() => recordPdfProjectEdit138(source,
      { order: [1, 2, 3], selected: [1, 1], mode: "selected" }, 3)).toThrow();
    expect(source).toEqual(snapshot);
  });
});
