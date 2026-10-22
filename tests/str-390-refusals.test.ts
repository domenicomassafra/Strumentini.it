import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { compareTables390, joinCsvTexts390 } from "../src/engines/table/relations-390";

const opts = { leftKeyColumns: [0], rightKeyColumns: [0], keyPrecision: "decimal-exact" as const, nullTokens: ["0"], emptyAsNull: false };

describe("STR-390 refusals: precision and duplicate identity", () => {
  it("rejects implicit empty compare identities before the native diff, unless matching is selected", () => {
    for (const keyPrecision of ["text", "decimal-exact"] as const) {
      const left = parseCsvTable("id,value\n,old");
      const right = parseCsvTable("id,value\n,new");
      const options = {
        leftKeyColumns: [0], rightKeyColumns: [0], leftCompareColumns: [1], rightCompareColumns: [1],
        keyPrecision,
      };
      expect(() => compareTables390(left, right, options)).toThrow(/NULL_COMPARE_KEY/u);
      const allowed = compareTables390(left, right, { ...options, nullKeyPolicy: "match" });
      expect([allowed.changedRows, allowed.removedRows, allowed.addedRows]).toEqual([1, 0, 0]);
      expect(allowed.changedCells[0]?.leftValue).toBe("old");
      expect(allowed.changedCells[0]?.rightValue).toBe("new");
    }
  });

  it("rejects duplicate whitespace and blank NULL keys before join, including decimal mode", () => {
    const left = "id,value\n ,A\n,B";
    const right = "id,value\n,C";
    for (const keyPrecision of ["text", "decimal-exact"] as const) {
      const options = {
        leftKeyColumns: [0], rightKeyColumns: [0], keyPrecision,
        nullTokens: [], emptyAsNull: true, nullKeyPolicy: "match" as const,
      };
      expect(() => joinCsvTexts390(left, right, { ...options, duplicatePolicy: "reject" }))
        .toThrow(/AMBIGUOUS_JOIN_KEYS/u);
      const expanded = joinCsvTexts390(left, right, { ...options, duplicatePolicy: "expand" });
      expect(expanded.table.rows).toEqual([[" ", "A", "", "C"], ["", "B", "", "C"]]);
      expect(joinCsvTexts390(left, right, { ...options, nullKeyPolicy: "never-match" }).matchedRows).toBe(0);
    }
    expect(left).toBe("id,value\n ,A\n,B");
    expect(right).toBe("id,value\n,C");
  });

  it("refuses duplicate numeric identities introduced by normalization", () => {
    expect(() => joinCsvTexts390("id,value\n00,A\n000,B", "id,value\n00,C", opts)).toThrow(/AMBIGUOUS_JOIN_KEYS/u);
    const expanded = joinCsvTexts390("id,value\n00,A\n000,B", "id,value\n00,C", { ...opts, duplicatePolicy: "expand" });
    expect(expanded.table.rows).toEqual([["00", "A", "00", "C"], ["000", "B", "00", "C"]]);
  });

  it("does not reject a valid zero-form when it is not itself a NULL token", () => {
    const compared = compareTables390(parseCsvTable("id,value\n00,old"), parseCsvTable("id,value\n000,new"), {
      ...opts, leftCompareColumns: [1], rightCompareColumns: [1], nullKeyPolicy: "reject",
    });
    expect(compared.changedCells[0]?.key).toEqual(["00"]);
    expect(compared.changedRows).toBe(1);
  });

  it("refuses precision loss and invalid decimal input instead of silently rounding", () => {
    expect(() => joinCsvTexts390("id,value\n1.001,A", "id,value\n1.00,B", {
      ...opts, keyPrecision: "decimal-scale", decimalPlaces: 2,
    })).toThrow(/KEY_PRECISION_LOSS/u);
    expect(() => joinCsvTexts390("id,value\n1e2,A", "id,value\n100,B", opts)).toThrow(/INVALID_DECIMAL_KEY/u);
  });

  it("does not merge composite keys with distinct NULL components", () => {
    const keys = { leftKeyColumns: [0, 1], rightKeyColumns: [0, 1], keyPrecision: "decimal-exact" as const, nullTokens: ["0"], emptyAsNull: false };
    const joined = joinCsvTexts390("a,b,value\n00,1,L", "a,b,value\n0,1,R", { ...keys, nullKeyPolicy: "match" });
    expect(joined.matchedRows).toBe(0);
  });
});
