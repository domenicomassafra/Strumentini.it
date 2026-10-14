/** #370: a cached formula result is not trustworthy CSV data, and explicit
 * numeric exports must never silently lose Excel's 15-digit precision. */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { csvToXlsx, xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

const injectRealFormula = String.raw`
import io, sys, zipfile
from xml.etree import ElementTree as ET
mode = sys.argv[1]
assert mode in ('stale', 'uncached', 'comment')
main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
original = io.BytesIO(sys.stdin.buffer.read())
result = io.BytesIO()
with zipfile.ZipFile(original) as source, zipfile.ZipFile(result, 'w', compression=zipfile.ZIP_DEFLATED) as target:
    assert source.testzip() is None
    for entry in source.infolist():
        data = source.read(entry.filename)
        if entry.filename == 'xl/worksheets/sheet1.xml':
            sheet = ET.fromstring(data)
            cell = sheet.find(".//{%s}c[@r='B2']" % main)
            assert cell is not None
            if mode == 'comment':
                sheet.append(ET.Comment('<f>this is documentation, not a formula</f>'))
            else:
                cell.clear()
                cell.set('r', 'B2')
                ET.SubElement(cell, '{%s}f' % main).text = '1+1'
                if mode == 'stale':
                    ET.SubElement(cell, '{%s}v' % main).text = '777'
            data = ET.tostring(sheet, encoding='utf-8', xml_declaration=True)
        target.writestr(entry, data)
payload = result.getvalue()
with zipfile.ZipFile(io.BytesIO(payload)) as source:
    assert source.testzip() is None
    sheet = ET.fromstring(source.read('xl/worksheets/sheet1.xml'))
    cell = sheet.find(".//{%s}c[@r='B2']" % main)
    formula = cell.find('{%s}f' % main)
    if mode == 'comment':
        assert formula is None
        assert b'<!--<f>this is documentation' in source.read('xl/worksheets/sheet1.xml')
    else:
        assert formula.text == '1+1'
        cache = cell.find('{%s}v' % main)
        assert (cache.text if cache is not None else None) == ('777' if mode == 'stale' else None)
sys.stdout.buffer.write(payload)
`;

async function actualXlsxWithFormula(mode: "stale" | "uncached" | "comment"): Promise<ArrayBuffer> {
  const ordinary = await csvToXlsx("id,calc\n00123,seed\n");
  const python = spawnSync("python3", ["-c", injectRealFormula, mode], {
    input: Buffer.from(ordinary.bytes), timeout: 10_000, maxBuffer: 2 * 1024 * 1024,
  });
  expect(python.status, python.stderr?.toString() ?? String(python.error)).toBe(0);
  const bytes = python.stdout;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("#370 XLSX formula-cache and decimal precision contract", () => {
  it("refuses a genuine formula cell carrying a forged stale 777 result, preserving source bytes", async () => {
    const actualZip = await actualXlsxWithFormula("stale");
    const before = new Uint8Array(actualZip).slice();
    await expect(xlsxToCsv(actualZip)).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    expect(new Uint8Array(actualZip)).toEqual(before);
  });

  it("refuses an uncached formula instead of publishing an apparently blank source cell", async () => {
    await expect(xlsxToCsv(await actualXlsxWithFormula("uncached")))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("accepts an authentic XLSX sheet whose XML comment merely mentions an f element", async () => {
    const result = await xlsxToCsv(await actualXlsxWithFormula("comment"));
    expect(result.csv).toBe("id,calc\n00123,seed");
  });

  it("rejects explicit numeric coercion beyond Excel's 15 significant digits", async () => {
    await expect(csvToXlsx("id,amount\n007,9007199254740993\n", {
      columnPolicies: [{ column: 1, type: "number" }],
    })).rejects.toMatchObject({ code: "INVALID_NUMBER" });
    await expect(csvToXlsx("id,amount\n007,0.1234567890123456\n", {
      columnPolicies: [{ column: 1, type: "number" }],
    })).rejects.toMatchObject({ code: "INVALID_NUMBER" });
  });

  it("refuses tiny nonzero decimals that JavaScript or Excel would silently round to zero", async () => {
    for (const decimal of [`0.${"0".repeat(400)}1`, `0.${"0".repeat(310)}5`]) {
      await expect(csvToXlsx(`amount\n${decimal}\n`, { columnPolicies: [{ column: 0, type: "number" }] }))
        .rejects.toMatchObject({ code: "INVALID_NUMBER" });
    }
    // Default-text import/export still keeps the original exact decimal.
    const textOnly = await csvToXlsx(`amount\n0.${"0".repeat(400)}1\n`);
    expect((await xlsxToCsv(textOnly.bytes)).csv).toBe(`amount\n0.${"0".repeat(400)}1`);
  });

  it("preserves long identifiers as text and ordinary explicitly typed numeric values", async () => {
    const workbook = await csvToXlsx("id,amount\n9007199254740993,12.50\n", {
      columnPolicies: [{ column: 1, type: "number" }],
    });
    const result = await xlsxToCsv(workbook.bytes);
    expect(parseCsvTable(result.csv).rows).toEqual([["9007199254740993", "12.5"]]);
  });
});
