import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { sortTable } from "../src/engines/table/operations";
import { tableDiff388 } from "../src/components/tools/table/TableTransformDiff388";

describe("STR-388 refusals: source survives failure and large samples", () => {
  it("refuses over 100k rows while retaining exact caller input", () => {
    const source = "id,raw\n" + "🌹,NULL\n".repeat(100_001);
    const original = source;
    expect(() => sortTable(parseCsvTable(source), { column: 0 })).toThrow();
    expect(source).toBe(original);
    expect(source.endsWith("🌹,NULL\n")).toBe(true);
  });

  it("bounds previews without modifying Unicode/null/duplicate origin", () => {
    const huge = "🌹" + "x".repeat(150_000);
    const source = "id,raw\n1," + huge + "\n1,NULL\n1,\n1,NULL";
    const preview = tableDiff388(source, source, ",");
    expect(preview.truncated).toBe(true);
    expect(preview.rows[1]?.after.length).toBeLessThan(250);
    expect(parseCsvTable(source).rows[0]?.[1]).toBe(huge);
    expect(parseCsvTable(source).rows[1]).toEqual(["1", "NULL"]);
    expect(parseCsvTable(source).rows[2]).toEqual(["1", ""]);
    expect(parseCsvTable(source).rows[3]).toEqual(["1", "NULL"]);
    expect(source).toContain("\n1,\n1,NULL");
  });

  it("never mutates original CSV while sorting locale mixed with nulls", () => {
    const source = 'name;value\nLéa;1,25\nAda;1.75\nAda;1,5\nAda;NULL';
    const original = source;
    const sorted = sortTable(parseCsvTable(source), { column: 1, comparator: "numeric", nulls: "last" });
    expect(sorted.output).toContain("Léa;1,25");
    expect(sorted.output).toContain("Ada;1.75");
    expect(source).toBe(original);
  });
});
