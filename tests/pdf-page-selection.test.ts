import { describe, expect, it } from "vitest";
import { parsePdfPageGroups, parsePdfPageSelection, strictPdfGroups, strictPdfPageNumbers } from "../src/engines/pdf/page-selection";

describe("ticket 217 shared bounded page grammar", () => {
  it("resolves single pages, ranges, all and every nth consistently", () => {
    expect(parsePdfPageSelection("3, 1-2, 6", 6)).toEqual([3, 1, 2, 6]);
    expect(parsePdfPageSelection("tutte", 4)).toEqual([1, 2, 3, 4]);
    expect(parsePdfPageSelection("*", 3)).toEqual([1, 2, 3]);
    expect(parsePdfPageSelection("ogni 2", 7)).toEqual([2, 4, 6]);
    expect(parsePdfPageGroups("1-2; 3,5; 4", 5)).toEqual([[1, 2], [3, 5], [4]]);
    expect(parsePdfPageGroups("blocchi:2", 5)).toEqual([[1, 2], [3, 4], [5]]);
    expect(parsePdfPageGroups("tutte", 3)).toEqual([[1, 2, 3]]);
  });
  it("does not silently discard malformed or out-of-range tokens", () => {
    for (const expression of ["1,,2", "1-0", "3-2", "1-4", "1,1", "1-2,2", "2x", "0", "1;", "", "ogni 4"]) {
      expect(() => parsePdfPageSelection(expression, 3), expression).toThrow(/token/u);
    }
    for (const expression of ["1-2;;3", "blocchi:0", "blocchi:5", "1;3-9"]) {
      expect(() => parsePdfPageGroups(expression, 4), expression).toThrow(/token/u);
    }
    expect(() => strictPdfPageNumbers([1, 1], 3)).toThrow();
    expect(() => strictPdfPageNumbers([0], 3)).toThrow();
    expect(() => strictPdfPageNumbers([4], 3)).toThrow();
    expect(() => strictPdfGroups([[1], []], 3)).toThrow();
    expect(() => parsePdfPageSelection("1,".repeat(5000), 3)).toThrow(/token/u);
    expect(() => parsePdfPageGroups("1;".repeat(5000), 3)).toThrow(/token/u);
  });
  it("keeps the 200-page cap across input pathways", () => {
    expect(parsePdfPageGroups("blocchi:10", 200)).toHaveLength(20);
    expect(() => parsePdfPageGroups("tutte", 201)).toThrow();
    expect(() => parsePdfPageSelection("ogni 2", 200)).not.toThrow();
  });
});
