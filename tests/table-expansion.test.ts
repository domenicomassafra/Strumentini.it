import { describe, expect, it } from "vitest";
import type { ToolModule } from "../src/runtime/types";
import { cleanCsvText, dedupeCsvTable, mapCsvColumns, parseCsvTable } from "../src/engines/table/csv";
import {
  csvTableToJson,
  detectCsvDelimiter,
  filterTable,
  fixTableEncoding,
  groupCountTable,
  joinCsvTables,
  jsonToCsvTable,
  pivotTable,
  profileColumnTypes,
  profileDuplicateRows,
  profileMissingValues,
  quickChartFromTable,
  selectTableColumns,
  sortTable,
  transposeTable,
  tsvToCsv,
  viewCsvTable,
} from "../src/engines/table/operations";
import csvCleanerModule from "../src/tools/csv-cleaner/module";
import csvDedupeModule from "../src/tools/csv-dedupe/module";
import csvColumnMapModule from "../src/tools/csv-column-map/module";
import csvViewerModule from "../src/tools/csv-viewer/module";
import csvDelimiterDetectorModule from "../src/tools/csv-delimiter-detector/module";
import csvEncodingFixerModule from "../src/tools/csv-encoding-fixer/module";
import csvColumnSelectorModule from "../src/tools/csv-column-selector/module";
import csvFilterModule from "../src/tools/csv-filter/module";
import csvSortModule from "../src/tools/csv-sort/module";
import csvGroupCountModule from "../src/tools/csv-group-count/module";
import csvJoinModule from "../src/tools/csv-join/module";
import csvPivotLiteModule from "../src/tools/csv-pivot-lite/module";
import csvToJsonModule from "../src/tools/csv-to-json/module";
import jsonToCsvModule from "../src/tools/json-to-csv/module";
import tsvToCsvModule from "../src/tools/tsv-to-csv/module";
import tableTransposeModule from "../src/tools/table-transpose/module";
import missingValueProfilerModule from "../src/tools/missing-value-profiler/module";
import columnTypeProfilerModule from "../src/tools/column-type-profiler/module";
import duplicateRowProfilerModule from "../src/tools/duplicate-row-profiler/module";
import quickChartModule from "../src/tools/quick-chart/module";
import { csvCleanerManifest } from "../src/tools/csv-cleaner/manifest";
import { csvDedupeManifest } from "../src/tools/csv-dedupe/manifest";
import { csvColumnMapManifest } from "../src/tools/csv-column-map/manifest";
import { csvViewerManifest } from "../src/tools/csv-viewer/manifest";
import { csvDelimiterDetectorManifest } from "../src/tools/csv-delimiter-detector/manifest";
import { csvEncodingFixerManifest } from "../src/tools/csv-encoding-fixer/manifest";
import { csvColumnSelectorManifest } from "../src/tools/csv-column-selector/manifest";
import { csvFilterManifest } from "../src/tools/csv-filter/manifest";
import { csvSortManifest } from "../src/tools/csv-sort/manifest";
import { csvGroupCountManifest } from "../src/tools/csv-group-count/manifest";
import { csvJoinManifest } from "../src/tools/csv-join/manifest";
import { csvPivotLiteManifest } from "../src/tools/csv-pivot-lite/manifest";
import { csvToJsonManifest } from "../src/tools/csv-to-json/manifest";
import { jsonToCsvManifest } from "../src/tools/json-to-csv/manifest";
import { tsvToCsvManifest } from "../src/tools/tsv-to-csv/manifest";
import { tableTransposeManifest } from "../src/tools/table-transpose/manifest";
import { missingValueProfilerManifest } from "../src/tools/missing-value-profiler/manifest";
import { columnTypeProfilerManifest } from "../src/tools/column-type-profiler/manifest";
import { duplicateRowProfilerManifest } from "../src/tools/duplicate-row-profiler/manifest";
import { quickChartManifest } from "../src/tools/quick-chart/manifest";

const tableText = "name,score\nAda,10\nGrace,2\nAda,10\n";

function run<T>(module: ToolModule, input: unknown): T {
  return module.run(input, { defaults: {} }, undefined) as T;
}

const manifests = [
  csvViewerManifest,
  csvCleanerManifest,
  csvDelimiterDetectorManifest,
  csvEncodingFixerManifest,
  csvDedupeManifest,
  csvColumnSelectorManifest,
  csvColumnMapManifest,
  csvFilterManifest,
  csvSortManifest,
  csvGroupCountManifest,
  csvJoinManifest,
  csvPivotLiteManifest,
  csvToJsonManifest,
  jsonToCsvManifest,
  tsvToCsvManifest,
  tableTransposeManifest,
  missingValueProfilerManifest,
  columnTypeProfilerManifest,
  duplicateRowProfilerManifest,
  quickChartManifest,
];

describe("table and CSV expansion", () => {
  it("binds all twenty candidates to local canonical manifests and routes", () => {
    expect(manifests).toHaveLength(20);
    expect(new Set(manifests.map((manifest) => manifest.id)).size).toBe(20);
    for (const manifest of manifests) {
      expect(manifest.route).toBe(`/tools/${manifest.id}`);
      expect(manifest.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
      expect(manifest.gold.oracleEntryId).toMatch(/^cand-0(?:2[1-9]|3[0-9]|40)$/u);
    }
  });

  it("21 previews a quoted CSV table with a bounded row preview", () => {
    const result = run<ReturnType<typeof viewCsvTable>>(csvViewerModule, { text: "a,b\n1,\"x,y\"\n2,3\n3,4\n", maxPreviewRows: 2 });
    expect(result.rowCount).toBe(3);
    expect(result.previewRows).toHaveLength(2);
    expect(result.previewTruncated).toBe(true);
    expect(result.output).toContain("\"x,y\"");
  });

  it("22 cleans BOM and record separators without changing parsed cells", () => {
    const result = run<ReturnType<typeof cleanCsvText>>(csvCleanerModule, { text: "\uFEFFa,b\r\n1,2\r\n" });
    expect(result.output).toBe("a,b\n1,2\n");
    expect(result.changes).toEqual({ strippedBom: true, normalizedRecordBreaks: 2 });
  });

  it("23 detects semicolon and tab delimiters", () => {
    expect(detectCsvDelimiter("a;b\n1;2\n3;4\n").delimiter).toBe(";");
    expect(detectCsvDelimiter("a\tb\n1\t2\n3\t4\n").delimiter).toBe("\t");
    expect(run<ReturnType<typeof detectCsvDelimiter>>(csvDelimiterDetectorModule, { text: "a|b\n1|2\n" }).label).toBe("pipe");
  });

  it("24 decodes UTF-16 and removes a byte-order mark", () => {
    const source = "a,b\n1,é\n";
    const bytes = new Uint8Array(2 + source.length * 2);
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    for (let index = 0; index < source.length; index += 1) {
      const code = source.charCodeAt(index);
      bytes[2 + index * 2] = code & 0xff;
      bytes[3 + index * 2] = code >> 8;
    }
    const result = run<ReturnType<typeof fixTableEncoding>>(csvEncodingFixerModule, { bytes });
    expect(result.detectedEncoding).toBe("utf-16le");
    expect(result.bomRemoved).toBe(true);
    expect(result.output).toBe(source);
  });

  it("25 dedupes whole rows with stable first occurrence", () => {
    const result = run<ReturnType<typeof dedupeCsvTable>>(csvDedupeModule, { text: tableText, mode: "whole-row" });
    expect(result.output).toBe("name,score\nAda,10\nGrace,2");
    expect(result.removedRows).toBe(1);
  });

  it("26 selects and reorders columns and fills missing cells", () => {
    const table = parseCsvTable("a,b,c\n1,2\n");
    expect(selectTableColumns(table, [2, 0]).output).toBe("c,a\n,1");
    expect(run<ReturnType<typeof selectTableColumns>>(csvColumnSelectorModule, { text: "a,b\n1,2\n", columns: [1, 0] }).headers).toEqual(["b", "a"]);
  });

  it("27 maps and renames columns with an explicit schema", () => {
    const result = run<ReturnType<typeof mapCsvColumns>>(csvColumnMapModule, { text: "a,b\n1,2\n", mapping: [{ sourceIndex: 1, outputName: "second" }] });
    expect(result.output).toBe("second\n2");
  });

  it("28 filters rows using explicit text and empty rules", () => {
    const table = parseCsvTable(tableText);
    expect(filterTable(table, { column: 0, operator: "equals", value: "Ada" }).matchedRows).toBe(2);
    expect(filterTable(table, { column: 1, operator: "empty", value: "" }).matchedRows).toBe(0);
    expect(run<ReturnType<typeof filterTable>>(csvFilterModule, { text: tableText, column: 0, operator: "contains", value: "da", caseSensitive: false }).matchedRows).toBe(2);
  });

  it("29 sorts numerically with stable ties", () => {
    const result = run<ReturnType<typeof sortTable>>(csvSortModule, { text: "name,score\nAda,10\nGrace,2\nLinus,10\n", column: 1, comparator: "numeric" });
    expect(result.output).toBe("name,score\nGrace,2\nAda,10\nLinus,10");
  });

  it("30 groups rows and counts them in first-seen order", () => {
    const result = run<ReturnType<typeof groupCountTable>>(csvGroupCountModule, { text: "team,score\nA,1\nB,2\nA,3\n", groupColumns: [0] });
    expect(result.output).toBe("team,count\nA,2\nB,1");
  });

  it("31 joins two tables on explicit keys and reports unmatched rows", () => {
    const result = run<ReturnType<typeof joinCsvTables>>(csvJoinModule, { leftText: "id,name\n1,Ada\n2,Grace\n", rightText: "id,city\n1,London\n3,Paris\n", leftKeyColumns: [0], rightKeyColumns: [0], joinType: "left" });
    expect(result.output).toContain("1,Ada,1,London");
    expect(result.unmatchedLeftRows).toBe(1);
  });

  it("32 creates a small pivot with a numeric aggregate", () => {
    const result = run<ReturnType<typeof pivotTable>>(csvPivotLiteModule, { text: "team,quarter,amount\nA,Q1,2\nA,Q2,3\nB,Q1,4\n", groupColumns: [0], valueHeaderColumn: 1, aggregateColumn: 2, aggregate: "sum" });
    expect(result.valueHeaders).toEqual(["Q1", "Q2"]);
    expect(result.output).toContain("A,2,3");
  });

  it("33 converts CSV records to JSON with deterministic headers", () => {
    const result = run<ReturnType<typeof csvTableToJson>>(csvToJsonModule, { text: "a,a\n1,2\n" });
    expect(JSON.parse(result.json)).toEqual([{ a: "1", a_2: "2" }]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("34 converts JSON objects to CSV with explicit schema expansion", () => {
    const result = run<ReturnType<typeof jsonToCsvTable>>(jsonToCsvModule, { json: JSON.stringify([{ a: 1 }, { a: 2, b: 3 }]), headerMode: "union" });
    expect(result.output).toBe("a,b\n1,\n2,3");
    expect(result.droppedKeys).toEqual([]);
  });

  it("35 converts quoted TSV values to CSV", () => {
    const result = run<ReturnType<typeof tsvToCsv>>(tsvToCsvModule, { text: "a\tb\n1\t\"x\ty\"\n" });
    expect(result.output).toBe("a,b\n1,x\ty");
  });

  it("36 transposes source columns into rows", () => {
    const result = run<ReturnType<typeof transposeTable>>(tableTransposeModule, { text: "name,age\nAda,37\n" });
    expect(result.output).toBe("field,name,age\nname,Ada\nage,37");
  });

  it("37 profiles missing values by column", () => {
    const result = run<ReturnType<typeof profileMissingValues>>(missingValueProfilerModule, { text: "a,b\n1,\n,2\n" });
    expect(result.totalMissing).toBe(2);
    expect(result.columns[0]?.missingRate).toBe(0.5);
  });

  it("38 profiles mixed column types without coercing them", () => {
    const result = run<ReturnType<typeof profileColumnTypes>>(columnTypeProfilerModule, { text: "value\n1\ntrue\n2026-01-01\n" });
    expect(result.columns[0]?.mixed).toBe(true);
    expect(result.columns[0]?.dominantType).toBe("mixed");
  });

  it("39 profiles duplicate rows and key groups", () => {
    const result = run<ReturnType<typeof profileDuplicateRows>>(duplicateRowProfilerModule, { text: "id,name\n1,Ada\n1,Ada\n2,Grace\n", maxExamples: 10 });
    expect(result.duplicateGroups).toBe(1);
    expect(result.duplicateRows).toBe(1);
    expect(result.groups[0]?.values).toEqual(["1", "Ada"]);
  });

  it("40 builds bounded chart points and escaped SVG labels", () => {
    const result = run<ReturnType<typeof quickChartFromTable>>(quickChartModule, { text: "label,value\nA,2\nB & C,3\n", labelColumn: 0, valueColumn: 1, maxBars: 10 });
    expect(result.points).toEqual([{ label: "A", value: 2 }, { label: "B & C", value: 3 }]);
    expect(result.svg).toContain("B &amp; C");
  });
});
