import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { compareTables390, joinCsvTexts390, mergeCsvParts390 } from "../src/engines/table/relations-390";

const precision = { leftKeyColumns: [0], rightKeyColumns: [0], keyPrecision: "decimal-exact" as const, nullTokens: ["0"], emptyAsNull: false };
const comparing = { ...precision, leftCompareColumns: [1], rightCompareColumns: [1] };

describe("STR-390 acceptance: explicit keyed relations", () => {
  it("does not join a numeric key to the configured NULL token, even when NULL matching is selected", () => {
    const left = "id,value\n00,left-valid";
    const right = "id,value\n0,right-null";
    const joined = joinCsvTexts390(left, right, { ...precision, nullKeyPolicy: "match" });
    expect(joined.matchedRows).toBe(0);
    expect(joined.table.rows).toEqual([]);
    const compared = compareTables390(parseCsvTable(left), parseCsvTable(right), { ...comparing, nullKeyPolicy: "match" });
    expect([compared.changedRows, compared.removedRows, compared.addedRows]).toEqual([0, 1, 1]);
    expect(compared.output).toContain("left-valid");
    expect(compared.output).toContain("right-null");
  });

  it("joins equivalent valid decimals when NULL keys are disallowed and retains the original cells", () => {
    const left = "id,value\n00,left-valid";
    const right = "id,value\n000,right-valid";
    const joined = joinCsvTexts390(left, right, { ...precision, nullKeyPolicy: "never-match" });
    expect(joined.matchedRows).toBe(1);
    expect(joined.table.rows).toEqual([["00", "left-valid", "000", "right-valid"]]);
    const compared = compareTables390(parseCsvTable(left), parseCsvTable(right), { ...comparing, nullKeyPolicy: "reject" });
    expect([compared.changedRows, compared.removedRows, compared.addedRows]).toEqual([1, 0, 0]);
    expect(compared.changedCells[0]?.key).toEqual(["00"]);
  });

  it("matches two explicit NULL keys only when allowed; keeps the original input values", () => {
    const left = "id,value\n0,A";
    const right = "id,value\n0,B";
    expect(joinCsvTexts390(left, right, { ...precision, nullKeyPolicy: "never-match" }).matchedRows).toBe(0);
    expect(joinCsvTexts390(left, right, { ...precision, nullKeyPolicy: "match" }).table.rows).toEqual([["0", "A", "0", "B"]]);
    expect(() => compareTables390(parseCsvTable(left), parseCsvTable(right), { ...comparing, nullKeyPolicy: "reject" })).toThrow(/NULL_COMPARE_KEY/u);
    expect(compareTables390(parseCsvTable(left), parseCsvTable(right), { ...comparing, nullKeyPolicy: "match" }).changedRows).toBe(1);
  });

  it("reassembles parts with original row order and repeats", () => {
    const merged = mergeCsvParts390([parseCsvTable("id,value\n1,old\n1,old"), parseCsvTable("id,value\n2,new")]);
    expect(merged.output).toBe("id,value\n1,old\n1,old\n2,new");
    expect(merged.partCounts).toEqual([2, 1]);
  });
});
