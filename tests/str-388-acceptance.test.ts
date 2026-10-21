import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { filterTable, sortTable } from "../src/engines/table/operations";
import { tableDiff388 } from "../src/components/tools/table/TableTransformDiff388";

describe("STR-388 acceptance: positional previews reflect CSV records", () => {
  it("detects reorder when distinct quoted cells have identical joined display", () => {
    const source = 'key;value\n"foo · bar";x\nfoo;"bar · x"';
    const result = sortTable(parseCsvTable(source), { column: 0, comparator: "lexical", direction: "asc" });
    const preview = tableDiff388(source, result.output, ";");
    expect(preview.changedPositions).toBe(2);
    expect(preview.rows[1]?.changed).toBe(true);
    expect(preview.rows[2]?.changed).toBe(true);
    expect(preview.rows[1]?.before).not.toBe(preview.rows[1]?.after);
  });

  it("compares full cells before truncating long Unicode display", () => {
    const prefix = "🌹".repeat(120);
    const source = "name;value\n" + prefix + "A;NULL";
    const after = "name;value\n" + prefix + "B;NULL";
    const preview = tableDiff388(source, after, ";");
    expect(preview.rows[1]?.changed).toBe(true);
    expect(preview.changedPositions).toBe(1);
    expect(preview.rows[1]?.before.length).toBeLessThan(250);
  });

  it("handles quoted multiline values and filter removes only selected rows", () => {
    const source = 'key;note;keep\n"🌹\nLéa";NULL;yes\nAda;1,25;no\nAda;1,25;yes';
    const result = filterTable(parseCsvTable(source), { column: 2, operator: "equals", value: "yes" });
    const diff = tableDiff388(source, result.output, ";");
    expect(result.output).toContain('"🌹\nLéa"');
    expect(result.output).toContain("1,25");
    expect(diff.changedPositions).toBeGreaterThan(0);
    expect(source).toContain("Ada;1,25;no");
  });
});
