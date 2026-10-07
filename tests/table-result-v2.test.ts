import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import type { ToolSummary } from "../src/catalog/manifest";
import { parseCsvTable } from "../src/engines/table/csv";
import {
  csvTableToJson,
  detectCsvDelimiter,
  quickChartFromTable,
  viewCsvTable,
} from "../src/engines/table/operations";
import {
  acceptsCsvTable,
  buildTableResultV2Model,
  emitsCsvTable,
} from "../src/components/tools/table/table-result-v2";

const OWNER_94_IDS = [
  "column-type-profiler",
  "csv-column-selector",
  "csv-delimiter-detector",
  "csv-encoding-fixer",
  "csv-filter",
  "csv-group-count",
  "csv-join",
  "csv-pivot-lite",
  "csv-sort",
  "csv-splitter",
  "csv-to-json",
  "csv-to-sql",
  "csv-viewer",
  "duplicate-row-profiler",
  "json-to-csv",
  "missing-value-profiler",
  "quick-chart",
  "table-transpose",
  "table-compare",
  "tsv-to-csv",
] as const;

describe("TableWorkbench Result v2", () => {
  it("declares table semantics for every ticket-94 TableWorkbench owner with descriptor-truthful capabilities", () => {
    const owned = catalog.filter(({ engine }) => engine === "table-operations") as readonly ToolSummary[];
    expect(owned.map(({ id }) => id).toSorted()).toEqual([...OWNER_94_IDS].toSorted());
    expect(owned).toHaveLength(20);

    for (const entry of owned) {
      expect(entry.result?.class, entry.id).toBe("table");
      const capabilities = new Set(entry.result?.capabilities ?? []);
      expect(capabilities.has("copy"), entry.id).toBe(true);
      expect(capabilities.has("download"), entry.id).toBe(true);
      expect(capabilities.has("reset"), entry.id).toBe(true);
      expect(capabilities.has("handoff"), entry.id).toBe(emitsCsvTable(entry.handoff));
      expect(capabilities.has("reuse"), entry.id).toBe(emitsCsvTable(entry.handoff) && acceptsCsvTable(entry.handoff));
    }
  });

  it("bounds the rendered table preview while keeping the full CSV export intact", () => {
    const long = "x".repeat(600);
    const rows = Array.from({ length: 40 }, (_, index) => index === 10
      ? `${index},${long},extra`
      : `${index},value-${index}`);
    const input = `id,value\n${rows.join("\n")}`;
    const result = viewCsvTable(input, { maxPreviewRows: 5 });
    const model = buildTableResultV2Model("csv-viewer", "viewer", result, input);

    expect(model.rows).toBe(40);
    expect(model.columns).toBe(2);
    expect(model.preview.shown).toBe(30);
    expect(model.preview.total).toBe(40);
    expect(model.preview.truncated).toBe(true);
    expect(model.preview.rows[10]?.[1]).toBe(long);
    expect(model.exportPayload).toContain("39,value-39");
    expect(model.exportPayload).toContain(long);
    expect(model.exportArtifact.byteLength).toBe(new TextEncoder().encode(model.exportPayload).byteLength);
    expect(model.rowWarningCount).toBe(1);
    expect(model.warnings.some(({ row }) => row === 12)).toBe(true);
    expect(result).toMatchObject({ dialect: { delimiter: ",", encoding: "utf-8", dynamicTyping: false }, affectedRows: 0, affectedCells: 0 });
  });

  it("uses the detected delimiter to build a real bounded table instead of a sample-only preview", () => {
    const input = `name;value\n${Array.from({ length: 35 }, (_, index) => `r${index};${index}`).join("\n")}`;
    const result = detectCsvDelimiter(input);
    const model = buildTableResultV2Model("csv-delimiter-detector", "delimiter", result, input);

    expect(result.delimiter).toBe(";");
    expect(result).toMatchObject({ dialect: { delimiter: ";", encoding: "utf-8", dynamicTyping: false }, affectedRows: 0, affectedCells: 0 });
    expect(model.rows).toBe(35);
    expect(model.preview.shown).toBe(30);
    expect(model.preview.truncated).toBe(true);
    expect(model.exportPayload).toContain("r34;34");
    expect(model.handoff.descriptor.rowCount).toBe(35);
  });

  it("keeps real row and column positions on warnings when the parsed table provides that evidence", () => {
    const input = "a,a\n1,2,3\n";
    const result = viewCsvTable(input);
    const model = buildTableResultV2Model("csv-viewer", "viewer", result, input);

    expect(model.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DUPLICATE_HEADER", column: 2 }),
      expect.objectContaining({ code: "RAGGED_ROW", row: 2 }),
    ]));
  });

  it("keeps JSON conversion output complete while presenting its records as a table preview", () => {
    const input = "a,b\n1,2\n3,4";
    const result = csvTableToJson(input, { pretty: true });
    const model = buildTableResultV2Model("csv-to-json", "to-json", result, input);

    expect(model.rows).toBe(2);
    expect(model.columns).toBe(2);
    expect(model.exportArtifact.mime).toBe("application/json");
    expect(model.exportPayload).toBe(result.json);
    expect(model.reusePayload).toBeNull();
    expect(JSON.parse(model.exportPayload)).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
  });

  it("preserves the complete SVG download for quick-chart while the Result v2 preview stays tabular", () => {
    const table = parseCsvTable("label,value\nA,2\nB,3");
    const result = quickChartFromTable(table, { labelColumn: 0, valueColumn: 1, aggregate: "sum" });
    const model = buildTableResultV2Model("quick-chart", "chart", result, "label,value\nA,2\nB,3");

    expect(model.preview.headers).toEqual(["label", "value"]);
    expect(model.preview.rows).toEqual([["A", "2"], ["B", "3"]]);
    expect(model.exportArtifact.mime).toBe("image/svg+xml");
    expect(model.exportPayload).toBe(result.svg);
    expect(model.reusePayload).toBe("label,value\nA,2\nB,3");
  });
});
