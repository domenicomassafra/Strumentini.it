/** #370: external workbook dependencies are not silently presented as independent CSV values. */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { csvToXlsx, xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

const makeXlsx = String.raw`
import io, sys, zipfile
from xml.etree import ElementTree as ET

mode = sys.argv[1]
source = io.BytesIO(sys.stdin.buffer.read())
dest = io.BytesIO()
main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
rel = 'http://schemas.openxmlformats.org/package/2006/relationships'
docs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
types = 'http://schemas.openxmlformats.org/package/2006/content-types'

with zipfile.ZipFile(source) as archive, zipfile.ZipFile(dest, 'w', compression=zipfile.ZIP_DEFLATED) as output:
    assert archive.testzip() is None
    for part in archive.infolist():
        body = archive.read(part.filename)
        if mode == 'external' and part.filename == 'xl/workbook.xml':
            root = ET.fromstring(body)
            refs = ET.SubElement(root, '{%s}externalReferences' % main)
            ET.SubElement(refs, '{%s}externalReference' % main, {'{%s}id' % docs: 'rId370'})
            body = ET.tostring(root, encoding='utf-8', xml_declaration=True)
        elif mode == 'external' and part.filename == 'xl/_rels/workbook.xml.rels':
            root = ET.fromstring(body)
            ET.SubElement(root, '{%s}Relationship' % rel, {
                'Id': 'rId370', 'Type': docs + '/externalLink', 'Target': 'externalLinks/externalLink1.xml'})
            body = ET.tostring(root, encoding='utf-8', xml_declaration=True)
        elif mode == 'external' and part.filename == '[Content_Types].xml':
            root = ET.fromstring(body)
            ET.SubElement(root, '{%s}Override' % types, {
                'PartName': '/xl/externalLinks/externalLink1.xml',
                'ContentType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml'})
            body = ET.tostring(root, encoding='utf-8', xml_declaration=True)
        elif mode == 'hyperlink' and part.filename == 'xl/worksheets/sheet1.xml':
            root = ET.fromstring(body)
            links = ET.SubElement(root, '{%s}hyperlinks' % main)
            ET.SubElement(links, '{%s}hyperlink' % main, {'ref': 'B2', '{%s}id' % docs: 'rIdLink'})
            body = ET.tostring(root, encoding='utf-8', xml_declaration=True)
        elif mode == 'hyperlink' and part.filename == 'xl/worksheets/_rels/sheet1.xml.rels':
            root = ET.fromstring(body)
            ET.SubElement(root, '{%s}Relationship' % rel, {
                'Id': 'rIdLink', 'Type': docs + '/hyperlink',
                'Target': 'https://example.invalid/reference', 'TargetMode': 'External'})
            body = ET.tostring(root, encoding='utf-8', xml_declaration=True)
        output.writestr(part, body)
    if mode == 'external':
        external = ET.Element('{%s}externalLink' % main)
        extbook = ET.SubElement(external, '{%s}externalBook' % main, {'{%s}id' % docs: 'rId1'})
        names = ET.SubElement(extbook, '{%s}sheetNames' % main)
        ET.SubElement(names, '{%s}sheetName' % main, {'val': 'Remote'})
        output.writestr('xl/externalLinks/externalLink1.xml', ET.tostring(external, encoding='utf-8', xml_declaration=True))
        external_rels = ET.Element('{%s}Relationships' % rel)
        ET.SubElement(external_rels, '{%s}Relationship' % rel, {
            'Id': 'rId1', 'Type': docs + '/externalLinkPath',
            'Target': 'https://example.invalid/remote.xlsx', 'TargetMode': 'External'})
        output.writestr('xl/externalLinks/_rels/externalLink1.xml.rels',
                        ET.tostring(external_rels, encoding='utf-8', xml_declaration=True))

with zipfile.ZipFile(io.BytesIO(dest.getvalue())) as checked:
    assert checked.testzip() is None
    assert 'xl/workbook.xml' in checked.namelist()
    if mode == 'external':
        assert 'xl/externalLinks/externalLink1.xml' in checked.namelist()
        assert b'example.invalid/remote.xlsx' in checked.read('xl/externalLinks/_rels/externalLink1.xml.rels')
    else:
        assert b'TargetMode="External"' in checked.read('xl/worksheets/_rels/sheet1.xml.rels')
sys.stdout.buffer.write(dest.getvalue())
`;

function pythonZip(source: ArrayBuffer, mode: "external" | "hyperlink"): ArrayBuffer {
  const result = spawnSync("python3", ["-c", makeXlsx, mode], {
    input: Buffer.from(source), timeout: 10_000, maxBuffer: 2 * 1024 * 1024,
  });
  expect(result.status, result.stderr?.toString() ?? String(result.error)).toBe(0);
  const bytes = result.stdout;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function verifyWithOpenpyxl(source: ArrayBuffer, expectedLinks: number): void {
  const python = process.env.SPREADSHEET370_PYTHON;
  if (!python) return; // Independent pinned donor oracle is explicit opt-in for CI.
  const probe = spawnSync(python, ["-c", String.raw`
import io,sys,zipfile,openpyxl
source = sys.stdin.buffer.read()
assert openpyxl.__version__ == '3.1.5'
with zipfile.ZipFile(io.BytesIO(source)) as archive:
    assert archive.testzip() is None
book = openpyxl.load_workbook(io.BytesIO(source), read_only=False, keep_links=True)
assert book.active['A2'].value == '00123'
assert book.active['B2'].value == 'safe'
print(len(book._external_links))
`], { input: Buffer.from(source), timeout: 10_000, maxBuffer: 1_000_000 });
  expect(probe.status, probe.stderr?.toString() ?? String(probe.error)).toBe(0);
  expect(Number(probe.stdout.toString().trim())).toBe(expectedLinks);
}

describe("#370 XLSX external-workbook relationship refusal with real ZIP and optional independent openpyxl", () => {
  it("refuses a genuinely decodable XLSX with an external-workbook dependency before CSV conversion", async () => {
    const normal = await csvToXlsx("id,value\n00123,safe\n");
    const linked = pythonZip(normal.bytes, "external");
    const unchanged = new Uint8Array(linked).slice();
    verifyWithOpenpyxl(linked, 1);
    await expect(xlsxToCsv(linked)).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    expect(new Uint8Array(linked)).toEqual(unchanged);
  });

  it("keeps an ordinary external hyperlink relationship inert and imports the visible CSV cells", async () => {
    const normal = await csvToXlsx("id,value\n00123,safe\n");
    const linked = pythonZip(normal.bytes, "hyperlink");
    verifyWithOpenpyxl(linked, 0);
    const result = await xlsxToCsv(linked);
    expect(parseCsvTable(result.csv).rows).toEqual([["00123", "safe"]]);
  });

  it("preserves the existing input byte quota and legitimate CSV/XLSX roundtrip", async () => {
    const normal = await csvToXlsx("id,code\n00123,00007\n");
    expect(parseCsvTable((await xlsxToCsv(normal.bytes)).csv).rows).toEqual([["00123", "00007"]]);
    await expect(xlsxToCsv(new ArrayBuffer(10 * 1024 * 1024 + 1)))
      .rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });
});
