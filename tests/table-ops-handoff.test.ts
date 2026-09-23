import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dedupeCsvTable, mapCsvColumns, parseCsvTable } from "../src/engines/table/csv";
import { proposeHandoff, type TableHandoffEnvelope } from "../src/runtime/handoff";
import { csvColumnMapManifest } from "../src/tools/csv-column-map/manifest";
import { csvDedupeManifest } from "../src/tools/csv-dedupe/manifest";

const fixture = JSON.parse(
  readFileSync(new URL("../quality/fixtures/csv-table-ops/vectors.json", import.meta.url), "utf8"),
) as {
  dedupe: Array<{ input:string; mode:"whole-row"|"key-columns"; key_columns?:number[]; expected:string; removed_rows:number }>;
  column_map: Array<{ input:string; mapping:Array<{source_index:number;output_name:string}>; expected:string; filled_missing_cells?:number }>;
};

describe("table expansion and typed handoff", () => {
  it("matches stable dedupe vectors and is idempotent", () => {
    for (const vector of fixture.dedupe) {
      const result = dedupeCsvTable(parseCsvTable(vector.input), {
        mode: vector.mode,
        ...(vector.key_columns === undefined ? {} : { keyColumns: vector.key_columns }),
      });
      expect(result.output).toBe(vector.expected);
      expect(result.removedRows).toBe(vector.removed_rows);
      const second = dedupeCsvTable(parseCsvTable(result.output), {
        mode: vector.mode,
        ...(vector.key_columns === undefined ? {} : { keyColumns: vector.key_columns }),
      });
      expect(second.output).toBe(result.output);
    }
  });

  it("keeps empty key rows distinct and addresses duplicate headers by index", () => {
    const empty = fixture.dedupe[1]!;
    const result = dedupeCsvTable(parseCsvTable(empty.input), { mode: "key-columns", keyColumns: [0] });
    expect(result.emptyKeyPolicy).toBe("keep");
    expect(result.output).toContain("Unknown A\n,Unknown B");
    const duplicateHeader = parseCsvTable(fixture.dedupe[2]!.input);
    expect(duplicateHeader.warnings.some((warning) => warning.code === "DUPLICATE_HEADER")).toBe(true);
  });

  it("maps columns by source index with explicit output schema and ragged disclosure", () => {
    for (const vector of fixture.column_map) {
      const result = mapCsvColumns(parseCsvTable(vector.input), vector.mapping.map((entry) => ({ sourceIndex: entry.source_index, outputName: entry.output_name })));
      expect(result.output).toBe(vector.expected);
      expect(result.filledMissingCells).toBe(vector.filled_missing_cells ?? 0);
    }
  });

  it("rejects ambiguous output schemas and missing source columns", () => {
    const table = parseCsvTable("a,b\n1,2");
    expect(() => mapCsvColumns(table, [{ sourceIndex: 0, outputName: "x" }, { sourceIndex: 1, outputName: "x" }])).toThrow("INVALID_OUTPUT_HEADERS");
    expect(() => mapCsvColumns(table, [{ sourceIndex: 2, outputName: "x" }])).toThrow("INVALID_COLUMN_MAP");
  });

  it("derives handoff compatibility only from descriptors and target declarations", () => {
    const payload = "id,name\n1,Ada\n2,Grace";
    const envelope: TableHandoffEnvelope = {
      descriptor: { type:"table",format:"csv",version:1,encoding:"utf-8",bytes:new TextEncoder().encode(payload).byteLength,rowCount:2,columnCount:2,columns:["id","name"],duplicateHeaders:false,raggedRows:false },
      payload,
    };
    expect(proposeHandoff(envelope, csvDedupeManifest)).toMatchObject({ compatible:true, lossy:false });
    expect(proposeHandoff(envelope, csvColumnMapManifest)).toMatchObject({ compatible:true, lossy:false });
    const oversized = { ...envelope, descriptor: { ...envelope.descriptor, bytes: 11 * 1024 * 1024 } };
    expect(proposeHandoff(oversized, csvDedupeManifest)).toMatchObject({ compatible:false, reason: expect.stringContaining("handoff limit") });
    const uniqueHeadersTarget = { ...csvDedupeManifest, handoff: { accepts: [{ type:"table" as const, format:"csv", requiresUniqueHeaders:true }] } };
    const duplicateHeaders = { ...envelope, descriptor: { ...envelope.descriptor, duplicateHeaders:true } };
    expect(proposeHandoff(duplicateHeaders, uniqueHeadersTarget)).toMatchObject({ compatible:false, reason: expect.stringContaining("unique") });
  });
});
