import { describe, expect, it } from "vitest";
import { adjacentPdfPageId, movePdfPageId } from "../src/engines/pdf/page-order-controls";

describe("ticket 216 visual page ordering", () => {
  it("moves stable PDF page identities without duplication or changes to omitted pages", () => {
    const original = [3, 1, 4, 2];
    expect(movePdfPageId(original, 3, 4)).toEqual([1, 4, 3, 2]);
    expect(movePdfPageId(original, 2, 1)).toEqual([3, 2, 1, 4]);
    expect(adjacentPdfPageId(original, 4, -1)).toEqual([3, 4, 1, 2]);
    expect(adjacentPdfPageId(original, 4, 1)).toEqual([3, 1, 2, 4]);
    expect(adjacentPdfPageId(original, 3, -1)).toEqual(original);
    expect(original).toEqual([3, 1, 4, 2]);
  });
  it("fails closed on missing, duplicate or malformed page identity", () => {
    expect(() => movePdfPageId([1, 2, 2], 1, 2)).toThrow();
    expect(() => movePdfPageId([0, 2], 0, 2)).toThrow();
    expect(() => movePdfPageId([1, 2], 1, 3)).toThrow();
    expect(() => adjacentPdfPageId([1, 2], 3, -1)).toThrow();
  });
});
