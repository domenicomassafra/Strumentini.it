import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/universal";
import { parseCsvTable } from "../src/engines/table/csv";
import {
  SpreadsheetInterchangeError,
  csvToXlsx,
  markdownTableToXlsx,
  xlsxToCsv,
} from "../src/engines/table/spreadsheet-interchange";

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("ticket 161 — bounded browser-capable XLSX interchange", () => {
  it("reopens a generated workbook and preserves text IDs/date-like strings unless a column is explicitly typed", async () => {
    const generated = await csvToXlsx(
      "id,date-like,amount,iso-date\n00123,03/04/2026,12.5,2026-10-07\n00007,11/12/2026,2,2026-01-05\n",
      {
        sheetName: "IDs",
        columnPolicies: [
          { column: 2, type: "number" },
          { column: 3, type: "date" },
        ],
      },
    );

    const reopened = await xlsxToCsv(generated.bytes);
    const table = parseCsvTable(reopened.csv);
    expect(reopened).toMatchObject({ selectedSheet: "IDs", rows: 2, columns: 4 });
    expect(table.rows).toEqual([
      ["00123", "03/04/2026", "12.5", "2026-10-07"],
      ["00007", "11/12/2026", "2", "2026-01-05"],
    ]);
    expect(generated.columnTypes).toEqual(["text", "text", "number", "date"]);
  });

  it("requires explicit sheet selection for a multi-sheet workbook", async () => {
    const workbook = writeXlsxFile([
      { sheet: "First", data: [[{ value: "001", type: String }]] },
      { sheet: "Second", data: [[{ value: "002", type: String }]] },
    ]);
    const blob = await workbook.toBlob();
    const bytes = await blob.arrayBuffer();
    await expect(xlsxToCsv(bytes)).rejects.toMatchObject<Partial<SpreadsheetInterchangeError>>({ code: "SHEET_SELECTION_REQUIRED" });
    await expect(xlsxToCsv(bytes, { sheet: "Second" })).resolves.toMatchObject({ selectedSheet: "Second", csv: "002" });
  });

  it("reads the pinned official ISTAT workbook and preserves its leading-zero administrative codes", async () => {
    const source = await readFile("quality/reference-data/italy/artifacts/115-administrative-geography/istat-elenco-comuni-2026-02-21.xlsx");
    const bytes = exactArrayBuffer(source);
    await expect(xlsxToCsv(bytes)).rejects.toMatchObject<Partial<SpreadsheetInterchangeError>>({ code: "SHEET_SELECTION_REQUIRED" });
    const converted = await xlsxToCsv(bytes, { sheet: "CODICI al 21_02_2026" });
    const table = parseCsvTable(converted.csv);
    expect(converted.sheetNames).toEqual(["CODICI al 21_02_2026", "NOTE", "Legenda"]);
    expect(table.rows[0]?.slice(0, 6)).toEqual(["01", "201", "001", "001", "001001", "Agliè"]);
  }, 30_000);

  it("converts the normalized Markdown-table model to XLSX and reopens it", async () => {
    const generated = await markdownTableToXlsx("| id | label |\n| --- | --- |\n| 007 | Bond |\n| 008 | Q |", { sheetName: "Agents" });
    const reopened = await xlsxToCsv(generated.bytes);
    expect(parseCsvTable(reopened.csv).rows).toEqual([["007", "Bond"], ["008", "Q"]]);
  });

  it("fails closed on implicit numeric/date coercion and invalid sheet names", async () => {
    await expect(csvToXlsx("id\n00123\n", { columnPolicies: [{ column: 0, type: "number" }] })).rejects.toMatchObject<Partial<SpreadsheetInterchangeError>>({ code: "INVALID_NUMBER" });
    await expect(csvToXlsx("value\n123.5\n", { columnPolicies: [{ column: 0, type: "number" }] })).resolves.toMatchObject({ columnTypes: ["number"] });
    await expect(csvToXlsx("date\n03/04/2026\n", { columnPolicies: [{ column: 0, type: "date" }] })).rejects.toMatchObject<Partial<SpreadsheetInterchangeError>>({ code: "INVALID_DATE" });
    await expect(csvToXlsx("a\n1\n", { sheetName: "bad/name" })).rejects.toMatchObject<Partial<SpreadsheetInterchangeError>>({ code: "INVALID_INPUT" });
  });
});
