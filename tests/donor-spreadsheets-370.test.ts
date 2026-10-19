import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/universal";
import { parseCsvTable, serializeCsvTable } from "../src/engines/table/csv";
import {
  SPREADSHEET_INTERCHANGE_LIMITS,
  csvToXlsx,
  xlsxToCsv,
} from "../src/engines/table/spreadsheet-interchange";

/**
 * #370: installed-engine behavior and an independent parser; no donor adoption.
 * Opt-in independent oracle: SPREADSHEET370_PYTHON points to an isolated
 * Python environment pinned to openpyxl==3.1.5 (see the decision report).
 */
const oraclePython = process.env.SPREADSHEET370_PYTHON;

function runOracle(code: string, input?: Buffer): Buffer {
  if (!oraclePython) throw new Error("SPREADSHEET370_PYTHON must point to the pinned openpyxl environment");
  const result = spawnSync(oraclePython, ["-c", code], {
    ...(input === undefined ? {} : { input }),
    timeout: 10_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Independent openpyxl oracle failed: ${result.error?.message ?? result.stderr.toString()}`);
  }
  return result.stdout;
}

function bufferToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

const pythonReadback = String.raw`
import io, json, sys, datetime
import openpyxl
assert openpyxl.__version__ == "3.1.5", openpyxl.__version__
book = openpyxl.load_workbook(io.BytesIO(sys.stdin.buffer.read()), read_only=True, data_only=False, keep_links=False)
def inspect(cell):
    value = cell.value
    if isinstance(value, (datetime.datetime, datetime.date)):
        value = value.isoformat()
    return {"value": value, "type": cell.data_type, "format": cell.number_format}
print(json.dumps({"sheets": book.sheetnames, "cells": [[inspect(c) for c in row] for row in book.active.iter_rows(min_row=2, max_row=2)]}, ensure_ascii=False))
`;

const pythonWorkbookReadback = String.raw`
import io, json, sys, datetime, openpyxl
assert openpyxl.__version__ == "3.1.5"
book = openpyxl.load_workbook(io.BytesIO(sys.stdin.buffer.read()), data_only=False, keep_links=False)
def inspect(cell):
    value = cell.value
    if isinstance(value, (datetime.datetime, datetime.date)):
        value = value.isoformat()
    return {"value": value, "type": cell.data_type, "format": cell.number_format}
print(json.dumps({sheet.title: [[inspect(cell) for cell in row] for row in sheet.iter_rows()]
                  for sheet in book.worksheets}, ensure_ascii=False))
`;

const pythonCsvReadback = String.raw`
import csv, io, json, sys
text = sys.stdin.buffer.read().decode("utf-8-sig")
print(json.dumps(list(csv.reader(io.StringIO(text, newline=""))), ensure_ascii=False))
`;

const pythonHostileWorkbook = String.raw`
import io, sys
from openpyxl import Workbook
book = Workbook()
sheet = book.active
sheet.title = "Inputs"
sheet.append(["id", "formula", "external-formula", "date-like", "hyperlink-text"])
sheet.append(["00123", "=1+1", '=HYPERLINK("https://example.invalid/remote", "click")', "03/04/2026", "OPEN"])
sheet["E2"].hyperlink = "https://example.invalid/external"
book.create_sheet("Secondary")["A1"] = "002"
buf = io.BytesIO()
book.save(buf)
sys.stdout.buffer.write(buf.getvalue())
`;

const pythonSyntheticMacroMarkerWorkbook = String.raw`
import io, sys, zipfile
from openpyxl import Workbook
book = Workbook()
book.active.append(["id"])
book.active.append(["00123"])
original = io.BytesIO()
book.save(original)
original.seek(0)
output = io.BytesIO()
with zipfile.ZipFile(original, "r") as source, zipfile.ZipFile(output, "w") as target:
    for part in source.infolist():
        data = source.read(part.filename)
        if part.filename == "[Content_Types].xml":
            data = data.replace(b"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml", b"application/vnd.ms-excel.sheet.macroEnabled.main+xml")
            data = data.replace(b"</Types>", b'<Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>')
        target.writestr(part, data)
    target.writestr("xl/vbaProject.bin", b"SYNTHETIC_NON_EXECUTABLE_MACRO_MARKER")
sys.stdout.buffer.write(output.getvalue())
`;

const pythonStaleCachedFormulaWorkbook = String.raw`
import io, sys, zipfile
from openpyxl import Workbook
book = Workbook()
sheet = book.active
sheet["A1"] = "calc"
sheet["A2"] = "=1+1"
original = io.BytesIO()
book.save(original)
original.seek(0)
output = io.BytesIO()
with zipfile.ZipFile(original) as source, zipfile.ZipFile(output, "w") as target:
    for part in source.infolist():
        data = source.read(part.filename)
        if part.filename == "xl/worksheets/sheet1.xml":
            before = b"<f>1+1</f><v />"
            assert before in data
            data = data.replace(before, b"<f>1+1</f><v>777</v>")
        target.writestr(part, data)
sys.stdout.buffer.write(output.getvalue())
`;

describe("#370 installed CSV/XLSX donor fidelity and refusal probes", () => {
  it("escapes potentially executable CSV formulas while preserving leading-zero IDs as strings", () => {
    const original = parseCsvTable('id,payload\n00123,"=HYPERLINK(""https://example.invalid"",""go"")"\n00007,+42\n');
    expect(original.rows[0]).toEqual(["00123", '=HYPERLINK("https://example.invalid","go")']);
    const exportCsv = serializeCsvTable(original);
    const returned = parseCsvTable(exportCsv);
    expect(returned.rows).toEqual([
      ["00123", '\'=HYPERLINK("https://example.invalid","go")'],
      ["00007", "'+42"],
    ]);
    expect(parseCsvTable(serializeCsvTable(parseCsvTable("value\n-2\n-2.75\n-CMD()\n-2+3\n"))).rows)
      .toEqual([["-2"], ["-2.75"], ["'-CMD()"], ["'-2+3"]]);
  });

  it("keeps formula-looking CSV values inert when writing an XLSX; rejects implicit type coercion", async () => {
    const output = await csvToXlsx('id,expression,date-like\n00123,=1+1,03/04/2026\n');
    const selected = await xlsxToCsv(output.bytes);
    expect(parseCsvTable(selected.csv).rows).toEqual([["00123", "'=1+1", "03/04/2026"]]);
    await expect(csvToXlsx("id\n00123\n", { columnPolicies: [{ column: 0, type: "number" }] }))
      .rejects.toMatchObject({ code: "INVALID_NUMBER" });
    await expect(csvToXlsx("when\n2026-02-30\n", { columnPolicies: [{ column: 0, type: "date" }] }))
      .rejects.toMatchObject({ code: "INVALID_DATE" });
  });

  it("never silently chooses a sheet in a multi-sheet workbook", async () => {
    const blob = await writeXlsxFile([
      { sheet: "Primary", data: [[{ value: "00123", type: String }]] },
      { sheet: "Secondary", data: [[{ value: "00007", type: String }]] },
    ]).toBlob();
    const bytes = await blob.arrayBuffer();
    await expect(xlsxToCsv(bytes)).rejects.toMatchObject({ code: "SHEET_SELECTION_REQUIRED" });
    expect(await xlsxToCsv(bytes, { sheet: "Secondary" })).toMatchObject({
      sheetNames: ["Primary", "Secondary"],
      selectedSheet: "Secondary",
      csv: "00007",
    });
    await expect(xlsxToCsv(bytes, { sheet: "Missing" })).rejects.toMatchObject({ code: "SHEET_NOT_FOUND" });
  });

  it("fails closed on malformed and oversized input without changing its supplied bytes", async () => {
    const malformed = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    const original = malformed.slice();
    await expect(xlsxToCsv(bufferToArrayBuffer(malformed))).rejects.toMatchObject({ code: "XLSX_READ_FAILED" });
    expect(malformed).toEqual(original);
    await expect(xlsxToCsv(new ArrayBuffer(SPREADSHEET_INTERCHANGE_LIMITS.maxInputBytes + 1)))
      .rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("measures a bounded local 12,006-cell roundtrip without assuming a portable SLA", async () => {
    const csv = `id,qty,when,label,city,notes\n${Array.from({ length: 2_000 }, (_, i) =>
      `${String(i).padStart(6, "0")},${i},2026-10-11,alpha,roma,row${i}`).join("\n")}\n`;
    const timings: number[] = [];
    for (let i = 0; i < 3; i++) {
      const started = performance.now();
      const xlsx = await csvToXlsx(csv);
      const result = await xlsxToCsv(xlsx.bytes);
      timings.push(performance.now() - started);
      const parsed = parseCsvTable(result.csv);
      expect(parsed.rows).toHaveLength(2_000);
      expect(parsed.rows[0]?.[0]).toBe("000000");
      expect(parsed.rows.at(-1)?.[0]).toBe("001999");
      expect(xlsx.byteLength).toBeLessThan(SPREADSHEET_INTERCHANGE_LIMITS.maxOutputBytes);
    }
    timings.sort((a, b) => a - b);
    console.info(`#370 perf: 2,001 rows incl. header / 12,006 cells; 3 samples p50=${timings[1]!.toFixed(0)} ms, max=${timings[2]!.toFixed(0)} ms`);
  });

  it.skipIf(!oraclePython)("independent pinned openpyxl confirms literal, number and date cell types", async () => {
    const output = await csvToXlsx("id,amount,day,expression\n00123,12.50,2026-02-21,=1+1\n", {
      sheetName: "Types",
      columnPolicies: [{ column: 1, type: "number" }, { column: 2, type: "date" }],
    });
    const readback = JSON.parse(runOracle(pythonReadback, Buffer.from(output.bytes)).toString()) as {
      sheets: string[];
      cells: Array<Array<{ value: unknown; type: string; format: string }>>;
    };
    expect(readback.sheets).toEqual(["Types"]);
    expect(readback.cells[0]?.map((cell) => [cell.value, cell.type])).toEqual([
      ["00123", "s"],
      [12.5, "n"],
      ["2026-02-21T00:00:00", "d"],
      ["=1+1", "s"],
    ]);
  });

  it.skipIf(!oraclePython)("independent formula/hyperlink workbook is refused without a lossy CSV export", async () => {
    const bytes = runOracle(pythonHostileWorkbook);
    const original = bytes.slice();
    const input = bufferToArrayBuffer(bytes);
    const source = JSON.parse(runOracle(pythonWorkbookReadback, bytes).toString()) as Record<string, Array<Array<{ value: unknown; type: string }>>>;
    expect(Object.keys(source)).toEqual(["Inputs", "Secondary"]);
    expect(source.Inputs?.[1]?.[1]).toMatchObject({ value: "=1+1", type: "f" });
    await expect(xlsxToCsv(input)).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    await expect(xlsxToCsv(input, { sheet: "Inputs" })).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    expect(bytes).toEqual(original);
  });

  it.skipIf(!oraclePython)("checks all cells on both sheets with independent XLSX and CSV parsers", async () => {
    const sheetRows = [
      ["id", "amount", "day", "date-like", "expression"],
      ["00123", 12.5, new Date("2026-02-21T00:00:00.000Z"), "03/04/2026", "=1+1"],
      ["00007", -2, new Date("2026-03-01T00:00:00.000Z"), "11/12/2026", "+42"],
    ] as const;
    const sheetData = sheetRows.map((row, rowIndex) => row.map((value, column) =>
      column === 2 && rowIndex > 0 ? { value, type: Date, format: "yyyy-mm-dd" }
        : column === 1 && rowIndex > 0 ? { value, type: Number }
        : { value: String(value), type: String }));
    const blob = await writeXlsxFile([
      { sheet: "Prima", data: sheetData },
      { sheet: "Seconda", data: [[{ value: "code", type: String }, { value: "total", type: String }],
        [{ value: "00009", type: String }, { value: 37.25, type: Number }]] },
    ]).toBlob();
    const bytes = Buffer.from(await blob.arrayBuffer());
    const original = bytes.slice();
    const inventory = JSON.parse(runOracle(pythonWorkbookReadback, bytes).toString()) as Record<string, Array<Array<{ value: unknown; type: string; format: string }>>>;
    expect(Object.keys(inventory)).toEqual(["Prima", "Seconda"]);
    expect(inventory.Prima?.[1]?.map(({ value, type }) => [value, type])).toEqual([
      ["00123", "s"], [12.5, "n"], ["2026-02-21T00:00:00", "d"], ["03/04/2026", "s"], ["=1+1", "s"],
    ]);
    expect(inventory.Prima?.[1]?.[2]?.format).toBe("yyyy-mm-dd");
    expect(inventory.Seconda?.[1]?.map(({ value, type }) => [value, type])).toEqual([["00009", "s"], [37.25, "n"]]);
    await expect(xlsxToCsv(bufferToArrayBuffer(bytes))).rejects.toMatchObject({ code: "SHEET_SELECTION_REQUIRED" });
    for (const [sheet, expected] of [
      ["Prima", [["id", "amount", "day", "date-like", "expression"],
        ["00123", "12.5", "2026-02-21", "03/04/2026", "'=1+1"],
        ["00007", "-2", "2026-03-01", "11/12/2026", "'+42"]]],
      ["Seconda", [["code", "total"], ["00009", "37.25"]]],
    ] as const) {
      const result = await xlsxToCsv(bufferToArrayBuffer(bytes), { sheet });
      const csvRows = JSON.parse(runOracle(pythonCsvReadback, Buffer.from(result.csv)).toString()) as string[][];
      expect(result.sheetNames).toEqual(["Prima", "Seconda"]);
      expect(csvRows).toEqual(expected);
    }
    expect(bytes).toEqual(original);
  });

  it.skipIf(!oraclePython)("refuses an OOXML macro marker before reading workbook cells", async () => {
    // This fixture is not an executable VBA sample. Its macro content-type and
    // vbaProject.bin member must nevertheless be refused before the XLSX reader.
    const bytes = runOracle(pythonSyntheticMacroMarkerWorkbook);
    const original = bytes.slice();
    await expect(xlsxToCsv(bufferToArrayBuffer(bytes)))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    expect(bytes).toEqual(original);
    // Rejecting a VBA marker is not a comprehensive XLSX sanitizer or
    // protection against hostile formulas, links, or archive parser defects.
  });

  it.skipIf(!oraclePython)("refuses stale cached formula values instead of exporting an incorrect result", async () => {
    const bytes = runOracle(pythonStaleCachedFormulaWorkbook);
    // The formula yields 2, but the attacker-controlled cache claims 777.
    await expect(xlsxToCsv(bufferToArrayBuffer(bytes)))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it.skipIf(!oraclePython)("independent pinned openpyxl reopens all 12,006 benchmark cells within the local timeout", async () => {
    const csv = `id,qty,when,label,city,notes\n${Array.from({ length: 2_000 }, (_, i) =>
      `${String(i).padStart(6, "0")},${i},2026-10-11,alpha,roma,row${i}`).join("\n")}\n`;
    const { bytes } = await csvToXlsx(csv);
    const started = performance.now();
    const result = JSON.parse(runOracle(String.raw`
import io, json, sys
from openpyxl import load_workbook
wb = load_workbook(io.BytesIO(sys.stdin.buffer.read()), read_only=True, data_only=False, keep_links=False)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
print(json.dumps({"sheets":wb.sheetnames,"rows":len(rows),"cols":len(rows[0]),"first":rows[1][0],"last":rows[-1][0]}))
`, Buffer.from(bytes)).toString()) as { sheets: string[]; rows: number; cols: number; first: string; last: string };
    const elapsed = performance.now() - started;
    expect(result).toEqual({ sheets: ["Sheet1"], rows: 2_001, cols: 6, first: "000000", last: "001999" });
    expect(elapsed).toBeLessThan(10_000);
    console.info(`#370 oracle: 2,001 rows / 12,006 cells; openpyxl readback ${elapsed.toFixed(0)} ms`);
  });
});
