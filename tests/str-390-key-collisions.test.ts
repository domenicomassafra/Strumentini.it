import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { compareTables390, joinCsvTexts390, mergeCsvParts390 } from "../src/engines/table/relations-390";
import joinModule from "../src/tools/csv-join/module";
import compareModule from "../src/tools/table-compare/module";

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../quality/fixtures/str-390/golden-key-collisions.json", import.meta.url)), "utf-8")) as {
  keyCollision: { left: string; right: string; matched: number };
  ambiguous: { left: string; right: string; expandedRows: number };
  splitMerge: { parts: string[]; expected: string };
};

describe("STR-390 golden key collisions", () => {
  it("frames composite keys and never joins NULL or lexical 01/1 implicitly", () => {
    const result = joinCsvTexts390(fixture.keyCollision.left, fixture.keyCollision.right, {
      leftKeyColumns: [0, 1], rightKeyColumns: [0, 1], joinType: "inner",
      nullTokens: ["NULL"], emptyAsNull: true,
    });
    expect(result.matchedRows).toBe(fixture.keyCollision.matched);
    expect(result.table.rows.map((row) => [row[2], row[5]])).toEqual([["L1", "R1"], ["L2", "R2"]]);
  });

  it("matches decimal keys exactly and retains original representations without rounding", () => {
    for (const [before, after] of [["01", "1"], ["1.2300", "1.23"], ["-0.00", "0"]]) {
      const result = joinCsvTexts390("id,label\n" + before + ",LEFT", "id,label\n" + after + ",RIGHT", {
        leftKeyColumns: [0], rightKeyColumns: [0], keyPrecision: "decimal-exact",
      });
      expect(result.matchedRows).toBe(1);
      expect(result.table.rows[0]).toEqual([before, "LEFT", after, "RIGHT"]);
    }
    expect(() => joinCsvTexts390("id,value\n1.001,A", "id,value\n1.00,B", {
      leftKeyColumns: [0], rightKeyColumns: [0], keyPrecision: "decimal-scale", decimalPlaces: 2,
    })).toThrow(/KEY_PRECISION_LOSS/u);
    expect(() => joinCsvTexts390("id,value\n1e3,A", "id,value\n1000,B", {
      leftKeyColumns: [0], rightKeyColumns: [0], keyPrecision: "decimal-exact",
    })).toThrow(/INVALID_DECIMAL_KEY/u);
  });

  it("refuses duplicate-key joins until Cartesian expansion is expressly selected", () => {
    const options = { leftKeyColumns: [0], rightKeyColumns: [0] };
    expect(() => joinCsvTexts390(fixture.ambiguous.left, fixture.ambiguous.right, options)).toThrow(/AMBIGUOUS_JOIN_KEYS/u);
    const expanded = joinCsvTexts390(fixture.ambiguous.left, fixture.ambiguous.right, {
      ...options, duplicatePolicy: "expand",
    });
    expect(expanded.table.rows).toHaveLength(fixture.ambiguous.expandedRows);
    expect(expanded.estimate.guardedBeforeMaterialization).toBe(true);
  });

  it("rejects NULL identity by default in diff and exposes all ambiguous row ordinals", () => {
    const options = { leftKeyColumns: [0], rightKeyColumns: [0], leftCompareColumns: [1], rightCompareColumns: [1],
      nullTokens: ["NULL"], emptyAsNull: true };
    expect(() => compareTables390(parseCsvTable("id,value\nNULL,old"), parseCsvTable("id,value\nNULL,new"), options)).toThrow(/NULL_COMPARE_KEY/u);
    const compared = compareTables390(parseCsvTable(fixture.ambiguous.left), parseCsvTable(fixture.ambiguous.right), options);
    expect(compared.ambiguousKeyCount).toBe(1);
    expect(compared.ambiguousKeys[0]).toEqual({ key: ["x"], leftRows: [2, 3], rightRows: [2, 3] });
    expect(compared.changedRows).toBe(0);
    const explicitlyMatched = compareTables390(parseCsvTable("id,value\nNULL,old"), parseCsvTable("id,value\nNULL,new"), {
      ...options, nullKeyPolicy: "match",
    });
    expect(explicitlyMatched.changedRows).toBe(1);
  });

  it("reassembles split parts without removing duplicate rows, but refuses schema drift", () => {
    const merged = mergeCsvParts390(fixture.splitMerge.parts.map((part) => parseCsvTable(part)));
    expect(merged.output).toBe(fixture.splitMerge.expected);
    expect(merged.partCounts).toEqual([2, 1]);
    expect(merged.preservedDuplicates).toBe(true);
    expect(() => mergeCsvParts390([parseCsvTable("a,b\n1,2"), parseCsvTable("b,a\n2,1")])).toThrow(/MERGE_SCHEMA_MISMATCH/u);
    expect(() => mergeCsvParts390([parseCsvTable("a,b\n1,2"), parseCsvTable("a,b\n1")])).toThrow(/RAGGED_PART_2_ROWS/u);
  });

  it("routes merge and precision through the real tool modules", async () => {
    const result = await joinModule.run({ operation: "merge-parts", partsTexts: fixture.splitMerge.parts }, {});
    expect((result as { output: string }).output).toBe(fixture.splitMerge.expected);
    const compared = await compareModule.run({
      leftText: "id,value\n01,before", rightText: "id,value\n1,after",
      leftKeyColumns: [0], rightKeyColumns: [0], leftCompareColumns: [1], rightCompareColumns: [1],
      keyPrecision: "decimal-exact",
    }, {});
    expect((compared as { changedCells: { key: string[] }[] }).changedCells[0]?.key).toEqual(["01"]);
    expect((compared as { output: string }).output).toContain("before");
  });
});
