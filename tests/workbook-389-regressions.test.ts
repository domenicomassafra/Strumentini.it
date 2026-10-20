import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { zipSync } from "fflate";
import { editWorkbookCell389 } from "../src/engines/table/workbook-formulas-389";
import { exportXlsxWorkbook389, openXlsxWorkbook389 } from "../src/engines/table/workbook-xlsx-389";

const office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const sheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const pkg = "http://schemas.openxmlformats.org/package/2006/relationships";
const content = "http://schemas.openxmlformats.org/package/2006/content-types";
const enc = new TextEncoder();

/** Minimal independent OOXML, including an intentionally stale formula cache. */
function fixture(dateStyleZero = false): ArrayBuffer {
  const files: Record<string, string> = {
    "[Content_Types].xml": `<Types xmlns="${content}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="${sheet}" xmlns:r="${office}"><sheets><sheet name="Dati" sheetId="1" r:id="rId1"/></sheets><calcPr calcMode="manual" fullPrecision="0" calcId="191029"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${office}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="${sheet}"><dimension ref="A1:C2"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Prezzo</t></is></c><c r="B1" t="inlineStr"><is><t>IVA</t></is></c><c r="C1" t="inlineStr"><is><t>Totale</t></is></c></row><row r="2"><c r="A2"${dateStyleZero ? ' s="0"' : ""}><v>0.1</v></c><c r="B2"><v>0.2</v></c><c r="C2"><f>A2+B2</f><v>999</v></c></row></sheetData></worksheet>`,
  };
  if (dateStyleZero) {
    files["[Content_Types].xml"] = files["[Content_Types].xml"]!.replace("</Types>", '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
    files["xl/styles.xml"] = `<styleSheet xmlns="${sheet}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  }
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, enc.encode(xml)])));
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
}

function ooxml(source: ArrayBuffer): { cells: Record<string, { formula: string | null; value: string | null }>; calcPr: Record<string, string> | null } {
  const script = [
    "import json,sys,io,zipfile,xml.etree.ElementTree as E",
    "with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as zip:",
    " s='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'",
    " root=E.fromstring(zip.read('xl/worksheets/sheet1.xml'))",
    " workbook=E.fromstring(zip.read('xl/workbook.xml'))",
    " cells={cell.get('r'):{'formula':cell.findtext(s+'f'),'value':cell.findtext(s+'v')} for cell in root.findall('.//'+s+'c')}",
    " calc=workbook.find(s+'calcPr')",
    " print(json.dumps({'cells':cells,'calcPr':calc.attrib if calc is not None else None}))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", script], { input: Buffer.from(source), encoding: "utf8", timeout: 15_000 });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as ReturnType<typeof ooxml>;
}

describe("STR-389 independent review regressions", () => {
  it("rounds 0.1 + 0.2 to Excel 15 significant digits, including real XLSX cache", () => {
    const source = fixture();
    const opened = openXlsxWorkbook389(source);
    const updated = editWorkbookCell389(opened, 1, 0, "0.1", "number");
    expect(updated.cells[1]![2]!.value).toBe("0.3");
    const exported = exportXlsxWorkbook389(source, updated);
    expect(ooxml(exported).cells.C2).toEqual({ formula: "A2+B2", value: "0.3" });
    expect(openXlsxWorkbook389(exported).cells[1]![2]!.value).toBe("0.3");
  });

  it("preserves the source fullPrecision and calcId attributes through export", () => {
    const source = fixture();
    const exported = exportXlsxWorkbook389(source, openXlsxWorkbook389(source));
    expect(ooxml(exported).calcPr).toMatchObject({ fullPrecision: "0", calcId: "191029", calcMode: "auto", fullCalcOnLoad: "1" });
  });

  it("keeps numeric intent after deleting and typing an existing formula dependency", () => {
    const opened = openXlsxWorkbook389(fixture());
    const cleared = editWorkbookCell389(opened, 1, 0, "");
    expect(cleared.cells[1]![0]!.kind).toBe("blank");
    const retyped = editWorkbookCell389(cleared, 1, 0, "3");
    expect(retyped.cells[1]![0]!.kind).toBe("number");
    expect(retyped.cells[1]![2]!.value).toBe("3.2");
  });

  it("rejects date format stored in the default cell style index 0", () => {
    expect(() => openXlsxWorkbook389(fixture(true))).toThrow(/UNSUPPORTED_WORKBOOK/);
  });
});
