import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/universal";
import { parseCsvTable, readBlobText } from "../src/engines/table/csv";
import {
  editCell387, exportEditableCsv387, parseEditable387,
} from "../src/engines/table/spreadsheet-edit-387";
import { csvToXlsx, xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

function independentCsv(text: string, delimiter = ","): string[][] {
  const process = spawnSync("python3", ["-c",
    "import csv,io,json,sys;print(json.dumps(list(csv.reader(io.StringIO(sys.stdin.read(),newline=''),delimiter=sys.argv[1])),ensure_ascii=False))", delimiter],
  { input: text, encoding: "utf8", timeout: 5_000 });
  if (process.error || process.status !== 0) throw new Error(String(process.stderr || process.error));
  return JSON.parse(process.stdout) as string[][];
}

describe("#146 STR-387: edit/export fidelity and independent consumers", () => {
  it("opens CSV UTF-8, edits one cell and preserves local dates, leading zeros and >15-digit decimals", () => {
    const original = "id;data locale;precisone;nota\n00123;03/04/2026;123456789012345678901;Caffè\n00007;11/12/2026;0,000001;Roma";
    const input = parseEditable387(original);
    const edited = editCell387(input, 0, 3, "Città");
    expect(input.rows[0]?.[3]).toBe("Caffè");
    const exported = exportEditableCsv387(edited);
    expect(independentCsv(exported, ";")).toEqual([
      ["id", "data locale", "precisone", "nota"],
      ["00123", "03/04/2026", "123456789012345678901", "Città"],
      ["00007", "11/12/2026", "0,000001", "Roma"],
    ]);
    expect(parseCsvTable(exported).delimiter).toBe(";");
  });

  it.each(["=SUM(1,2)", "+cmd", "@SUM(1)", "-CMD()", "\t=1+1", "  =1+1", "\r+1"])(
    "refuses formula-like CSV cell %s without producing output", (poison) => {
      expect(() => exportEditableCsv387(editCell387(parseEditable387("id,value\n00123,ok"), 0, 1, poison)))
        .toThrow(/INVALID_INPUT.*Formula/u);
      expect(() => parseEditable387("id,value\n00123,\"" + poison.replaceAll("\"", "\"\"") + "\""))
        .toThrow();
    },
  );

  it("rejects dangerous headers, uneven rows and over-limit grids", () => {
    expect(() => parseEditable387("id,=WEBSERVICE(1)\n00123,x")).toThrow(/Formula/u);
    expect(() => parseEditable387("id,value\n00123")).toThrow(/irregolari/u);
    expect(() => parseEditable387("id,value\n" + "1,ok\n".repeat(201))).toThrow(/200 righe/u);
  });

  it("roundtrips XLSX through the distinct read-excel-file consumer with preserved source types", async () => {
    const original = await csvToXlsx(
      "id,importo,iso,locale,grande\n00123,12.50,2026-03-04,03/04/2026,123456789012345678901",
      { sheetName: "Dati", columnPolicies: [{ column: 1, type: "number" }, { column: 2, type: "date" }] },
    );
    const read = await xlsxToCsv(original.bytes, { refuseFormulaLikeText: true, strictEditing: true });
    expect(read.columnTypes).toEqual(["text", "number", "date", "text", "text"]);
    const changed = editCell387(parseEditable387(read.csv), 0, 0, "00007");
    const saved = await csvToXlsx(exportEditableCsv387(changed), {
      sheetName: read.selectedSheet,
      columnPolicies: read.columnTypes.map((type, column) => ({ column, type: type as "number" | "date" | "text" })),
    });
    const independent = await xlsxToCsv(saved.bytes);
    expect(independent.columnTypes).toEqual(read.columnTypes);
    expect(parseCsvTable(independent.csv).rows).toEqual([
      ["00007", "12.5", "2026-03-04", "03/04/2026", "123456789012345678901"],
    ]);
  });

  it("refuses XLSX formula-like literal, calculated cell and multi-sheet ambiguity", async () => {
    const literal = await csvToXlsx("id,label\n00123,=1+1");
    await expect(xlsxToCsv(literal.bytes, { refuseFormulaLikeText: true }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    const multi = await writeXlsxFile([
      { sheet: "Uno", data: [[{ value: "001", type: String }]] },
      { sheet: "Due", data: [[{ value: "002", type: String }]] },
    ]).toBlob();
    await expect(xlsxToCsv(await multi.arrayBuffer())).rejects.toMatchObject({ code: "SHEET_SELECTION_REQUIRED" });
  });

  it("refuses numeric display masks that would silently remove visible leading zeros", async () => {
    const formatted = await writeXlsxFile([
      [{ value: "id", type: String }],
      [{ value: 123, type: Number, format: "00000" }],
    ]).toBlob();
    await expect(xlsxToCsv(await formatted.arrayBuffer(), { strictEditing: true }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("refuses conditional formatting and data validation instead of discarding workbook rules", async () => {
    const source = await csvToXlsx("id,amount\n00123,12");
    const injected = spawnSync("python3", ["-c", String.raw`
import io,sys,zipfile
from xml.etree import ElementTree as ET
ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ET.register_namespace('',ns)
original=io.BytesIO(sys.stdin.buffer.read());output=io.BytesIO()
with zipfile.ZipFile(original) as src,zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as dst:
    for entry in src.infolist():
        data=src.read(entry.filename)
        if entry.filename=='xl/worksheets/sheet1.xml':
            root=ET.fromstring(data)
            rules=ET.SubElement(root,'{%s}conditionalFormatting'%ns,{'sqref':'B2'})
            rule=ET.SubElement(rules,'{%s}cfRule'%ns,{'type':'expression','priority':'1'})
            ET.SubElement(rule,'{%s}formula'%ns).text='B2>10'
            valid=ET.SubElement(root,'{%s}dataValidations'%ns,{'count':'1'})
            check=ET.SubElement(valid,'{%s}dataValidation'%ns,{'type':'whole','sqref':'B2'})
            ET.SubElement(check,'{%s}formula1'%ns).text='0'
            ET.SubElement(check,'{%s}formula2'%ns).text='100'
            data=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        dst.writestr(entry,data)
sys.stdout.buffer.write(output.getvalue())
`], { input: Buffer.from(source.bytes), timeout: 10_000, maxBuffer: 2 * 1024 * 1024 });
    expect(injected.status, injected.stderr?.toString() ?? String(injected.error)).toBe(0);
    const value = injected.stdout.buffer.slice(injected.stdout.byteOffset,
      injected.stdout.byteOffset + injected.stdout.byteLength) as ArrayBuffer;
    await expect(xlsxToCsv(value, { strictEditing: true }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("reads valid accents and rejects malformed UTF-8 before edit/export", async () => {
    expect(parseEditable387(await readBlobText(new Blob([new TextEncoder().encode("nome\ncaffè")]))).rows)
      .toEqual([["caffè"]]);
    await expect(readBlobText(new Blob([Uint8Array.of(110, 111, 109, 101, 10, 0xe9)])))
      .rejects.toMatchObject({ code: "INVALID_ENCODING" });
  });
});
