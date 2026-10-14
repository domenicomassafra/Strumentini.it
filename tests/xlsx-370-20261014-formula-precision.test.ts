/** #370: a cached formula result is not trustworthy CSV data, and explicit
 * numeric exports must never silently lose Excel's 15-digit precision. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

const independentWorksheetVariants = String.raw`
import io,sys,zipfile
from xml.etree import ElementTree as ET
mode=sys.argv[1]
assert mode in ('hidden-formula','relocated-formula')
data=io.BytesIO(sys.stdin.buffer.read()); out=io.BytesIO()
m='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ns='http://schemas.openxmlformats.org/package/2006/content-types'
rel='http://schemas.openxmlformats.org/package/2006/relationships'
part='xl/worksheets/sheet2.xml'
renamed='xl/nonstandard/hidden-values.xml'
with zipfile.ZipFile(data) as original, zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
    assert original.testzip() is None
    for entry in original.infolist():
        blob=original.read(entry.filename)
        if entry.filename==part:
            root=ET.fromstring(blob)
            cell=root.find('.//{%s}c[@r="B2"]'%m)
            assert cell is not None
            cell.clear();cell.set('r','B2')
            ET.SubElement(cell,'{%s}f'%m).text='1+1'
            ET.SubElement(cell,'{%s}v'%m).text='777'
            blob=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        if mode=='hidden-formula' and entry.filename=='xl/workbook.xml':
            root=ET.fromstring(blob)
            sheets=root.findall('.//{%s}sheet'%m)
            assert len(sheets)==2
            sheets[1].set('state','hidden')
            blob=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        if mode=='relocated-formula' and entry.filename=='xl/_rels/workbook.xml.rels':
            root=ET.fromstring(blob)
            worksheet=[r for r in root if r.get('Type','').endswith('/worksheet')]
            assert len(worksheet)==2
            assert worksheet[1].get('Target')=='worksheets/sheet2.xml'
            worksheet[1].set('Target','nonstandard/hidden-values.xml')
            blob=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        if mode=='relocated-formula' and entry.filename=='[Content_Types].xml':
            root=ET.fromstring(blob)
            override=[x for x in root if x.get('PartName')=='/xl/worksheets/sheet2.xml']
            assert len(override)==1 and override[0].get('ContentType','').endswith('worksheet+xml')
            override[0].set('PartName','/'+renamed)
            blob=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        if mode=='relocated-formula' and entry.filename==part:
            target.writestr(renamed,blob)
        else:
            target.writestr(entry,blob)
final=out.getvalue()
with zipfile.ZipFile(io.BytesIO(final)) as reopened:
    assert reopened.testzip() is None
    target_part=renamed if mode=='relocated-formula' else part
    assert len(ET.fromstring(reopened.read(target_part)).findall('.//{%s}f'%m))==1
    wb=ET.fromstring(reopened.read('xl/workbook.xml'))
    sheets=wb.findall('.//{%s}sheet'%m)
    assert len(sheets)==2
    if mode=='hidden-formula': assert sheets[1].get('state')=='hidden' and sheets[0].get('state')!= 'hidden'
    if mode=='relocated-formula':
        rr=ET.fromstring(reopened.read('xl/_rels/workbook.xml.rels'))
        assert len([r for r in rr if r.get('Target')=='nonstandard/hidden-values.xml' and r.get('Type','').endswith('/worksheet')])==1
        ct=ET.fromstring(reopened.read('[Content_Types].xml'))
        assert len([x for x in ct if x.get('PartName')=='/'+renamed and x.get('ContentType','').endswith('worksheet+xml')])==1
sys.stdout.buffer.write(final)
`;

async function twoSheetFormula(mode: "hidden-formula" | "relocated-formula"): Promise<ArrayBuffer> {
  const { default: writeXlsx } = await import("write-excel-file/universal");
  const sheet = (value: string) => [
    [{ value: "id", type: String }, { value: "calc", type: String }],
    [{ value: "00123", type: String }, { value, type: String }],
  ];
  const original = await writeXlsx([
    { sheet: "Visible", data: sheet("visible") },
    { sheet: "Hidden", data: sheet("seed") },
  ]).toBlob();
  const python = spawnSync("python3", ["-c", independentWorksheetVariants, mode], {
    input: Buffer.from(await original.arrayBuffer()), timeout: 10_000, maxBuffer: 3 * 1024 * 1024,
  });
  expect(python.status, python.stderr?.toString() ?? String(python.error)).toBe(0);
  const bytes = python.stdout;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("#370 XLSX formula-cache and decimal precision contract", () => {
  it("retains CSV import for a genuine chart-rich worksheet with only chart range references", async () => {
    const source = readFileSync("tests/ooxml-68-corpus/complex.xlsx");
    // Independent actual ZIP/XML oracle: chart <c:f> does not represent a
    // cell's calculated formula. No XLSX reader or importer is consulted.
    const oracle = spawnSync("python3", ["-c", String.raw`
import io,sys,zipfile
from xml.etree import ElementTree as ET
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
    assert z.testzip() is None
    worksheet=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    chart=ET.fromstring(z.read('xl/charts/chart1.xml'))
    assert not worksheet.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}f')
    refs=chart.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/chart}f')
    assert [r.text for r in refs]==['Sales!$A$2:$A$4','Sales!$B$2:$B$4']
`,], { input: source, timeout: 10_000 });
    expect(oracle.status, oracle.stderr?.toString() ?? String(oracle.error)).toBe(0);
    const before = Uint8Array.from(source);
    const bytes = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer;
    const output = await xlsxToCsv(bytes);
    expect(output.csv).toBe("Quarter,Value,,Reference\nQ1,10,,Editable format\nQ2,23,,\nQ3,31,,");
    expect(output.rows).toBe(3);
    expect(parseCsvTable(output.csv).rows[0]).toEqual(["Q1", "10", "", "Editable format"]);
    expect(new Uint8Array(bytes)).toEqual(before);
  });

  it("refuses stale cached formula on a real hidden worksheet even when the visible sheet is selected", async () => {
    const bytes = await twoSheetFormula("hidden-formula");
    await expect(xlsxToCsv(bytes, { sheet: "Visible" })).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("refuses stale cached formula in an authentic noncanonical worksheet part referenced by OOXML metadata", async () => {
    const bytes = await twoSheetFormula("relocated-formula");
    await expect(xlsxToCsv(bytes, { sheet: "Visible" })).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

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
