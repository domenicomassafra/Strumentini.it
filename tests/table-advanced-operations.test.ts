import { describe, expect, it } from "vitest";
import {
  CSV_SPLIT_MAX_CHUNKS,
  compareCsvText,
  csvTextToSql,
  quoteSqlIdentifier,
  splitCsvBlob,
} from "../src/engines/table/advanced";
import { parseCsvTable } from "../src/engines/table/csv";
import { buildTableResultV2Model } from "../src/components/tools/table/table-result-v2";
import { TableWorkbench } from "../src/components/tools/table/TableWorkbench";
import csvToSqlManifest from "../src/tools/csv-to-sql/manifest";
import csvSplitterManifest from "../src/tools/csv-splitter/manifest";
import tableCompareManifest from "../src/tools/table-compare/manifest";

describe("advanced CSV/table operations", () => {
  it("quotes PostgreSQL, MySQL and SQLite identifiers/values while keeping type/null policy explicit", () => {
    const input = "id,name,note,nullable,empty\n00123,Zoë,O'Reilly,NULL,\n42,李,\"hello, world\",text,";
    const postgres = csvTextToSql(input, {
      dialect: "postgresql",
      tableName: 'order"book',
      nullTokens: ["NULL"],
      emptyAsNull: false,
    });
    expect(postgres.columns.map(({ type }) => type)).toEqual(["text", "text", "text", "text", "text"]);
    expect(postgres.output).toContain('CREATE TABLE "order""book"');
    expect(postgres.output).toContain("E'00123'");
    expect(postgres.output).toContain("E'O''Reilly'");
    expect(postgres.output).toContain("NULL, E''");
    expect(postgres.output).toContain("E'李'");
    const sqlResultModel = buildTableResultV2Model("csv-to-sql", "sql", postgres, input);
    expect(sqlResultModel.exportArtifact).toMatchObject({ mime: "application/sql", issues: [], download: { ready: true } });

    const mysql = csvTextToSql("value\ntrue\nfalse", { dialect: "mysql", tableName: "tick`table" });
    expect(mysql.output).toContain("`tick``table`");
    expect(mysql.output).toContain("BOOLEAN");
    expect(mysql.output).toContain("(TRUE)");

    const sqlite = csvTextToSql("value\ntrue\nfalse", { dialect: "sqlite", tableName: "flags" });
    expect(sqlite.output).toContain('"value" INTEGER');
    expect(sqlite.output).toContain("(1)");
    expect(sqlite.output).toContain("(0)");
    expect(quoteSqlIdentifier('a"b', "sqlite")).toBe('"a""b"');

    const hostile = csvTextToSql("value\n\"\\'; DROP TABLE users; --\"", { dialect: "mysql", tableName: "safe" });
    expect(hostile.output).toContain("'\\\\''; DROP TABLE users; --'");
  });

  it("supports deliberate type overrides and rejects values that do not satisfy them", () => {
    const result = csvTextToSql("code\n00123", {
      dialect: "postgresql",
      tableName: "items",
      typeOverrides: { 0: "integer" },
    });
    expect(result.columns[0]).toMatchObject({ type: "integer", source: "override" });
    expect(result.output).toContain("(123)");
    expect(() => csvTextToSql("value\nabc", {
      dialect: "sqlite",
      tableName: "items",
      typeOverrides: { 0: "real" },
    })).toThrow(/INVALID_SQL_VALUE/u);
  });

  it("does not declare network capability or SQL execution for the generator", () => {
    expect(csvToSqlManifest.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
    expect(csvToSqlManifest.capabilities).not.toContain("reference-network");
    expect(csvToSqlManifest.capabilities).not.toContain("content-network");
    expect(csvToSqlManifest.capabilities).not.toContain("local-db");
  });

  it("reconstructs quoted semicolon CSV semantics and repeats the header once per row chunk", async () => {
    const source = "id;note\r\n1;\"prima\r\nseconda\"\r\n2;città\r\n3;fine\r\n";
    const expected = parseCsvTable(source);
    const result = await splitCsvBlob(new Blob([source]), { mode: "rows", rowsPerChunk: 2 });
    const reconstructed = result.chunks.flatMap((chunk) => {
      expect(chunk.content.startsWith(`id;note${result.recordSeparator}`)).toBe(true);
      expect(chunk.content.split(`id;note${result.recordSeparator}`)).toHaveLength(2);
      const parsed = parseCsvTable(chunk.content);
      expect(parsed.header).toEqual(expected.header);
      expect(parsed.delimiter).toBe(";");
      return parsed.rows;
    });
    expect(reconstructed).toEqual(expected.rows);
    expect(result.recordSeparator).toBe("\r\n");
    expect(result.chunks.map(({ rowCount }) => rowCount)).toEqual([2, 1]);
  });

  it("property-style: row splitting preserves every generated record across chunk sizes", async () => {
    for (const totalRows of [1, 2, 7, 31]) {
      const sourceRows = Array.from({ length: totalRows }, (_, index) => [String(index), `v,${index}`, index % 3 === 0 ? `line ${index}\nnext` : `plain-${index}`]);
      const source = `id,label,note\n${sourceRows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")}`;
      const expected = parseCsvTable(source).rows;
      for (const rowsPerChunk of [1, 2, 5, 16]) {
        const result = await splitCsvBlob(new Blob([source]), { mode: "rows", rowsPerChunk, readChunkBytes: 17 });
        const reconstructed = result.chunks.flatMap((chunk) => parseCsvTable(chunk.content).rows);
        expect(reconstructed).toEqual(expected);
      }
    }
  });

  it("splits by approximate bytes without dropping rows", async () => {
    const rows = Array.from({ length: 20 }, (_, index) => `${index},${"x".repeat(40)}`);
    const source = `id,value\n${rows.join("\n")}`;
    const result = await splitCsvBlob(new Blob([source]), { mode: "bytes", targetBytes: 220, readChunkBytes: 32 });
    expect(result.chunks.length).toBeGreaterThan(2);
    expect(result.chunks.reduce((sum, chunk) => sum + chunk.rowCount, 0)).toBe(20);
    expect(result.chunks.every((chunk) => chunk.bytes <= 220)).toBe(true);
  });

  it("bounds the number of generated chunks for pathological split settings", async () => {
    const source = `id,value\n${Array.from({ length: CSV_SPLIT_MAX_CHUNKS + 1 }, (_, index) => `${index},x`).join("\n")}`;
    await expect(splitCsvBlob(new Blob([source]), { mode: "rows", rowsPerChunk: 1 })).rejects.toThrow(/CSV_TOO_MANY_CHUNKS/u);
  });

  it("aborts a streamed split between bounded source reads", async () => {
    const controller = new AbortController();
    const source = `id,value\n${Array.from({ length: 5000 }, (_, index) => `${index},${"x".repeat(80)}`).join("\n")}`;
    await expect(splitCsvBlob(new Blob([source]), {
      mode: "rows",
      rowsPerChunk: 500,
      readChunkBytes: 4096,
      onProgress(fraction) {
        if (fraction > 0) controller.abort();
      },
    }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("keeps parser input buffering bounded on a 50 MiB-class CSV fixture", async () => {
    const row = `1,${"x".repeat(2044)}\n`;
    const targetBytes = 48 * 1024 * 1024;
    const rowBytes = new TextEncoder().encode(row).byteLength;
    const rowCount = Math.floor((targetBytes - 11) / rowBytes);
    const blob = new Blob(["id,payload\n", ...Array.from({ length: rowCount }, () => row)]);
    expect(blob.size).toBeGreaterThan(47 * 1024 * 1024);

    const result = await splitCsvBlob(blob, { mode: "rows", rowsPerChunk: 1000 });
    expect(result.rowCount).toBe(rowCount);
    expect(result.chunks.reduce((sum, chunk) => sum + chunk.rowCount, 0)).toBe(rowCount);
    expect(result.peakParserBufferUpperBoundBytes).toBeLessThan(2 * 1024 * 1024);
    expect(result.readChunkBytes).toBeLessThanOrEqual(256 * 1024);
    expect(result.chunks.every((chunk) => chunk.content.startsWith("id,payload\n"))).toBe(true);
  }, 30_000);

  it("surfaces duplicate-key ambiguity and retains changed-cell provenance under null/case policy", () => {
    const left = "id,name,note\n1,Ada,NULL\n2,Grace,x\n3,Lin,a\n3,Lin,b";
    const right = "id,name,note\n1,ada,\n2,Grace,y\n3,Lin,c\n3,Lin,d\n4,Nikola,z";
    const result = compareCsvText(left, right, {
      leftKeyColumns: [0], rightKeyColumns: [0],
      leftCompareColumns: [1, 2], rightCompareColumns: [1, 2],
      caseSensitive: false, nullTokens: ["NULL"], emptyAsNull: true,
    });
    expect(result).toMatchObject({ addedRows: 1, removedRows: 0, changedRows: 1, ambiguousKeyCount: 1 });
    expect(result.changedCells).toEqual([
      expect.objectContaining({ key: ["2"], leftRow: 3, rightRow: 3, leftColumn: 2, rightColumn: 2, leftColumnName: "note", rightColumnName: "note", leftValue: "x", rightValue: "y" }),
    ]);
    expect(result.ambiguousKeys[0]).toEqual({ key: ["3"], leftRows: [4, 5], rightRows: [4, 5] });
    expect(result.warnings[0]?.code).toBe("DUPLICATE_KEY");
  });

  it("property-style: unique keyed tables report exactly the generated change/add/remove counts", () => {
    for (const size of [1, 5, 23, 97]) {
      const left = `id,value\n${Array.from({ length: size }, (_, index) => `${index},left-${index}`).join("\n")}`;
      const rightRows = Array.from({ length: size }, (_, index) => `${index},${index % 4 === 0 ? `right-${index}` : `left-${index}`}`);
      rightRows.shift();
      rightRows.push(`${size},added`);
      const result = compareCsvText(left, `id,value\n${rightRows.join("\n")}`, {
        leftKeyColumns: [0], rightKeyColumns: [0], leftCompareColumns: [1], rightCompareColumns: [1],
      });
      const expectedChanged = Array.from({ length: size }, (_, index) => index).filter((index) => index !== 0 && index % 4 === 0).length;
      expect(result.removedRows).toBe(1);
      expect(result.addedRows).toBe(1);
      expect(result.changedRows).toBe(expectedChanged);
      expect(result.changedCells).toHaveLength(expectedChanged);
      expect(result.ambiguousKeyCount).toBe(0);
    }
  });

  it("bounds the Result v2 compare preview while preserving the complete diff export", () => {
    const leftRows = Array.from({ length: 45 }, (_, index) => `${index},before-${index}`);
    const rightRows = Array.from({ length: 45 }, (_, index) => `${index},after-${index}`);
    const left = `id,value\n${leftRows.join("\n")}`;
    const right = `id,value\n${rightRows.join("\n")}`;
    const result = compareCsvText(left, right, {
      leftKeyColumns: [0], rightKeyColumns: [0], leftCompareColumns: [1], rightCompareColumns: [1],
    });
    const model = buildTableResultV2Model("table-compare", "compare", result, left);
    expect(model.preview.shown).toBe(30);
    expect(model.preview.total).toBe(45);
    expect(model.preview.truncated).toBe(true);
    expect(model.exportPayload).toBe(result.output);
    expect(model.exportPayload).toContain("after-44");
  });

  it("keeps all three tools local and bound to their reserved oracle entries", () => {
    expect(typeof TableWorkbench).toBe("function");
    expect([csvToSqlManifest, csvSplitterManifest, tableCompareManifest].map((manifest) => [manifest.id, manifest.gold.oracleEntryId, manifest.runtime.network])).toEqual([
      ["csv-to-sql", "cand-228", "forbidden"],
      ["csv-splitter", "cand-229", "forbidden"],
      ["table-compare", "cand-230", "forbidden"],
    ]);
  });
});
