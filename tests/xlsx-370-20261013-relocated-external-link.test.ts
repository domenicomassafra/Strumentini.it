/** #370 P1 review: valid external workbook parts need not use the canonical directory. */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { csvToXlsx, xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

const relocatedExternalLink = String.raw`
import io, sys, zipfile
from xml.etree import ElementTree as ET
mode = sys.argv[1]
assert mode in ('full', 'relationship-only', 'content-type-only')
main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
rels = 'http://schemas.openxmlformats.org/package/2006/relationships'
docs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
types = 'http://schemas.openxmlformats.org/package/2006/content-types'
original = io.BytesIO(sys.stdin.buffer.read())
changed = io.BytesIO()
with zipfile.ZipFile(original) as source, zipfile.ZipFile(changed, 'w', compression=zipfile.ZIP_DEFLATED) as destination:
    assert source.testzip() is None
    for entry in source.infolist():
        path = entry.filename
        body = source.read(path)
        if path == 'xl/workbook.xml':
            root = ET.fromstring(body)
            refs = ET.SubElement(root, '{%s}externalReferences' % main)
            ET.SubElement(refs, '{%s}externalReference' % main, {'{%s}id' % docs: 'rId370'})
            body = ET.tostring(root, encoding='utf-8', xml_declaration=True)
        elif path == 'xl/_rels/workbook.xml.rels':
            root = ET.fromstring(body)
            rel_type = 'customXml' if mode == 'content-type-only' else 'externalLink'
            ET.SubElement(root, '{%s}Relationship' % rels, {
                'Id': 'rId370', 'Type': docs + '/' + rel_type, 'Target': 'links/book1.xml'})
            body = ET.tostring(root, encoding='utf-8', xml_declaration=True)
        elif path == '[Content_Types].xml':
            root = ET.fromstring(body)
            ET.SubElement(root, '{%s}Override' % types, {
                'PartName': '/xl/links/book1.xml',
                'ContentType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml'})
            body = ET.tostring(root, encoding='utf-8', xml_declaration=True)
            # A literal XML character reference is decoded by legitimate parsers.
            body = body.replace(b'externalLink+xml', b'externalL&#x69;nk+xml')
            if mode == 'relationship-only':
                body = body.replace(b'externalL&#x69;nk+xml', b'generic+xml')
            else:
                assert b'externalL&#x69;nk+xml' in body
        destination.writestr(path, body)
    external = ET.Element('{%s}externalLink' % main)
    book = ET.SubElement(external, '{%s}externalBook' % main, {'{%s}id' % docs: 'rId1'})
    names = ET.SubElement(book, '{%s}sheetNames' % main)
    ET.SubElement(names, '{%s}sheetName' % main, {'val': 'Remote'})
    destination.writestr('xl/links/book1.xml', ET.tostring(external, encoding='utf-8', xml_declaration=True))
    ext_rels = ET.Element('{%s}Relationships' % rels)
    ET.SubElement(ext_rels, '{%s}Relationship' % rels, {
        'Id': 'rId1', 'Type': docs + '/externalLinkPath',
        'Target': 'https://example.invalid/remote.xlsx', 'TargetMode': 'External'})
    destination.writestr('xl/links/_rels/book1.xml.rels',
                         ET.tostring(ext_rels, encoding='utf-8', xml_declaration=True))

result = changed.getvalue()
with zipfile.ZipFile(io.BytesIO(result)) as archive:
    assert archive.testzip() is None
    paths = set(archive.namelist())
    assert 'xl/links/book1.xml' in paths
    assert 'xl/links/_rels/book1.xml.rels' in paths
    assert not any('externalLinks/' in name for name in paths)
    if mode != 'relationship-only':
        assert b'externalL&#x69;nk+xml' in archive.read('[Content_Types].xml')
    assert b'links/book1.xml' in archive.read('xl/_rels/workbook.xml.rels')
sys.stdout.buffer.write(result)
`;

async function realRelocatedXlsx(mode: "full" | "relationship-only" | "content-type-only" = "full"): Promise<ArrayBuffer> {
  const ordinary = await csvToXlsx("id,value\n00123,safe\n");
  const output = spawnSync("python3", ["-c", relocatedExternalLink, mode], {
    input: Buffer.from(ordinary.bytes), timeout: 15_000, maxBuffer: 2 * 1024 * 1024,
  });
  expect(output.status, output.stderr?.toString() ?? String(output.error)).toBe(0);
  const bytes = output.stdout;
  const result = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  if (process.env.SPREADSHEET370_PYTHON) {
    const verify = spawnSync(process.env.SPREADSHEET370_PYTHON, ["-c", String.raw`
import io, sys, openpyxl, zipfile
assert openpyxl.__version__ == '3.1.5'
input = sys.stdin.buffer.read()
with zipfile.ZipFile(io.BytesIO(input)) as archive:
    assert archive.testzip() is None
book = openpyxl.load_workbook(io.BytesIO(input), keep_links=True, read_only=False)
assert book.active['A2'].value == '00123'
assert book.active['B2'].value == 'safe'
if sys.argv[1] != 'content-type-only':
    assert len(book._external_links) == 1
    assert book._external_links[0].file_link.Target == 'https://example.invalid/remote.xlsx'
`, mode], { input: Buffer.from(result), timeout: 10_000, maxBuffer: 1_000_000 });
    expect(verify.status, verify.stderr?.toString() ?? String(verify.error)).toBe(0);
  }
  return result;
}

describe("#370 reviewer P1: moved external parts and XML numeric entity", () => {
  it("refuses an independently reopened valid XLSX with relocated workbook dependency", async () => {
    const source = await realRelocatedXlsx();
    const unchanged = new Uint8Array(source).slice();
    await expect(xlsxToCsv(source)).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    expect(new Uint8Array(source)).toEqual(unchanged);
  });

  it("refuses external workbook relationship Type even without the externalLink content type", async () => {
    const source = await realRelocatedXlsx("relationship-only");
    await expect(xlsxToCsv(source)).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("refuses numeric-entity externalLink content type even with no active workbook dependency", async () => {
    const source = await realRelocatedXlsx("content-type-only");
    await expect(xlsxToCsv(source)).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("still accepts an ordinary CSV/XLSX without workbook external links", async () => {
    const ordinary = await csvToXlsx("id,label\n00123,Comune\n");
    await expect(xlsxToCsv(ordinary.bytes)).resolves.toMatchObject({ csv: "id,label\n00123,Comune" });
  });

  it("rejects DTD or custom XML entities in the bounded OOXML manifest", async () => {
    const ordinary = await csvToXlsx("id,label\n00123,Comune\n");
    const mutate = spawnSync("python3", ["-c", String.raw`
import io, sys, zipfile
source = io.BytesIO(sys.stdin.buffer.read())
output = io.BytesIO()
with zipfile.ZipFile(source) as archive, zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as target:
    for part in archive.infolist():
        data = archive.read(part.filename)
        if part.filename == '[Content_Types].xml':
            mark = b'<Types'
            assert mark in data
            data = data.replace(mark, b'<!DOCTYPE Types [<!ENTITY external SYSTEM "file:///tmp/blocked">]><Types', 1)
        target.writestr(part, data)
with zipfile.ZipFile(io.BytesIO(output.getvalue())) as archive:
    assert archive.testzip() is None
    assert b'<!DOCTYPE' in archive.read('[Content_Types].xml')
sys.stdout.buffer.write(output.getvalue())
`], { input: Buffer.from(ordinary.bytes), timeout: 10_000, maxBuffer: 2 * 1024 * 1024 });
    expect(mutate.status, mutate.stderr?.toString() ?? String(mutate.error)).toBe(0);
    const bytes = mutate.stdout;
    const hostile = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await expect(xlsxToCsv(hostile)).rejects.toMatchObject({ code: "XLSX_READ_FAILED" });
  });
});
