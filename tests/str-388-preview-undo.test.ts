import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsvTable, cleanCsvText } from "../src/engines/table/csv";
import { filterTable, sortTable } from "../src/engines/table/operations";
import { tableDiff388 } from "../src/components/tools/table/TableTransformDiff388";

const fixture = (name: string) => readFileSync(new URL(`../quality/fixtures/str-388/${name}`, import.meta.url), "utf8");

describe("STR-388 golden diff/undo input fidelity", () => {
  const source = fixture("golden-mixed-locale.csv");

  it("sorts IT comma, US dot, null and stable duplicates against independent golden bytes", () => {
    const result = sortTable(parseCsvTable(source), { column: 1, comparator: "numeric", nulls: "last" });
    expect(result.output).toBe(fixture("golden-sorted.csv").trimEnd());
    expect(result.rowCountEffect).toEqual({ inputRows: 5, outputRows: 5, delta: 0 });
    const preview = tableDiff388(source, result.output, ";");
    expect(preview.rows[1]?.before).toContain("Rosa");
    expect(preview.rows[1]?.after).toContain("Léa");
    expect(preview.changedPositions).toBeGreaterThan(0);
  });

  it("filters text without converting NULL or deduplicating rows", () => {
    const result = filterTable(parseCsvTable(source), { column: 2, operator: "equals", value: "ok", nullTokens: ["NULL"], emptyAsNull: true });
    expect(result.output).toBe(fixture("golden-filtered.csv").trimEnd());
    expect(result.rowCountEffect).toEqual({ inputRows: 5, outputRows: 2, delta: -3 });
    expect(result.rejectedRows).toBe(3);
    expect(tableDiff388(source, result.output, ";").rows[1]?.after).toContain("Ada");
  });

  it("retains Unicode code points, empty/null distinction, exact origin and refuses oversized input", () => {
    const original = "\ufeffnome;importo;stato\r\n🌹 Zoë;1,5;NULL\r\n🌹 Zoë;1,5;\r\n";
    const clean = cleanCsvText(original);
    expect(original).toContain("\ufeff");
    expect(clean.output).toContain("🌹 Zoë");
    expect(clean.output).toContain(";NULL");
    expect(clean.output).toContain("1,5;");
    expect(clean.changes.strippedBom).toBe(true);
    const changed = tableDiff388(original, clean.output, ";");
    expect(changed.rows[1]?.after).toContain("🌹");
    // Applying a transform never modifies the original byte-for-byte snapshot.
    const applied = sortTable(parseCsvTable(original), { column: 1, comparator: "numeric" }).output;
    const undone = original;
    expect(undone).toBe(original);
    expect(applied).not.toBe(undone);
    const hugeCell = "🚀".repeat(90_000);
    const huge = `id,description\n1,${hugeCell}\n2,NULL`;
    const sample = tableDiff388(huge, huge, ",");
    expect(sample.truncated).toBe(true);
    expect(sample.rows[1]?.after).toContain("🚀");
    expect(sample.rows[1]?.after.length).toBeLessThan(250);
    expect(parseCsvTable(huge).rows[0]?.[1]).toBe(hugeCell);
  });

  it("rejects more than 100k rows without accepting partial data as result", () => {
    const oversized = `id,value\n${Array.from({ length: 100_001 }, (_, i) => `${i},NULL`).join("\n")}`;
    expect(() => sortTable(parseCsvTable(oversized), { column: 0 })).toThrow();
  });
});
