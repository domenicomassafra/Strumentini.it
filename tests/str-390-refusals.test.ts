import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { compareTables390, joinCsvTexts390 } from "../src/engines/table/relations-390";

const opts = { leftKeyColumns: [0], rightKeyColumns: [0], keyPrecision: "decimal-exact" as const, nullTokens: ["0"], emptyAsNull: false };

describe("STR-390 refusals: precision and duplicate identity", () => {
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
