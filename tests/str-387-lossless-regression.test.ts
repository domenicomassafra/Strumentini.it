import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/universal";
import { csvToXlsx, xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

describe("STR-387 independently proven no-silent-loss workbook admission", () => {
  it("refuses numeric headers before value-only XLSX editing can silently turn them into strings", async () => {
    const blob = await writeXlsxFile([{
      sheet: "Dati",
      data: [
        [{ value: 123, type: Number }, { value: "titolo", type: String }],
        [{ value: "prima", type: String }, { value: "nota", type: String }],
      ],
    }]).toBlob();
    await expect(xlsxToCsv(await blob.arrayBuffer(), { strictEditing: true, refuseFormulaLikeText: true }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("refuses a valid independent workbook definedNames entry before losing it during save", async () => {
    const source = await csvToXlsx("id,value\n00123,ok", { sheetName: "Dati" });
    const process = spawnSync("python3", ["-c", String.raw`
import io,sys,zipfile
from xml.etree import ElementTree as ET
ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ET.register_namespace('',ns)
original=io.BytesIO(sys.stdin.buffer.read())
output=io.BytesIO()
with zipfile.ZipFile(original) as src,zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as dst:
    for entry in src.infolist():
        data=src.read(entry.filename)
        if entry.filename=='xl/workbook.xml':
            root=ET.fromstring(data)
            names=ET.SubElement(root,'{%s}definedNames'%ns)
            ET.SubElement(names,'{%s}definedName'%ns,{'name':'AuditRange'}).text='Dati!$A$2'
            data=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        dst.writestr(entry,data)
sys.stdout.buffer.write(output.getvalue())
`], { input: Buffer.from(source.bytes), timeout: 10_000, maxBuffer: 2 * 1024 * 1024 });
    expect(process.status, process.stderr?.toString() ?? String(process.error)).toBe(0);
    const bytes = process.stdout.buffer.slice(process.stdout.byteOffset,
      process.stdout.byteOffset + process.stdout.byteLength) as ArrayBuffer;
    await expect(xlsxToCsv(bytes, { strictEditing: true, refuseFormulaLikeText: true }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });
});
