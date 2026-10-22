import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { unzipSync, zipSync } from "fflate";
import writeXlsxFile from "write-excel-file/universal";
import readXlsxFile from "read-excel-file/universal";
import {
  computeFormula389, editWorkbookCell389, expandWorkbook389, WorkbookError389,
} from "../src/engines/table/workbook-formulas-389";
import { openXlsxWorkbook389, exportXlsxWorkbook389 } from "../src/engines/table/workbook-xlsx-389";

const encoder = new TextEncoder(), decoder = new TextDecoder();

function changeArchive(bytes: ArrayBuffer, transform: (archive: Record<string, Uint8Array>) => void): ArrayBuffer {
  const parts = unzipSync(new Uint8Array(bytes));
  transform(parts);
  const zip = zipSync(parts, { level: 6 });
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
}

async function realWorkbook(): Promise<ArrayBuffer> {
  const blob = await writeXlsxFile([{
    sheet: "Dati", data: [
      [{ value: "id", type: String }, { value: "Importo", type: String }, { value: "Totale", type: String }],
      [{ value: "00123", type: String }, { value: 4, type: Number }, { value: "placeholder", type: String }],
      [{ value: "00007", type: String }, { value: 5, type: Number }, { value: "placeholder", type: String }],
    ],
  }]).toBlob();
  return changeArchive(await blob.arrayBuffer(), (parts) => {
    const original = decoder.decode(parts["xl/worksheets/sheet1.xml"]!);
    let replaced = original.replace(/<c r="C2"[^>]*>[^]*?<\/c>/u, '<c r="C2"><f>SUM(B2:B3)</f><v>777</v></c>');
    replaced = replaced.replace(/<c r="C3"[^>]*>[^]*?<\/c>/u, '<c r="C3"><f>C2+B3</f><v>888</v></c>');
    expect(replaced).not.toBe(original);
    expect(replaced).toContain("<v>888</v>");
    parts["xl/worksheets/sheet1.xml"] = encoder.encode(replaced);
  });
}

describe("STR-389 XLSX workbook formula graph and faithful export", () => {
  it("recalculates stale source caches, dependent references and exports real formulas + validated cached results", async () => {
    const source = await realWorkbook();
    const opened = openXlsxWorkbook389(source);
    expect(opened.sheetName).toBe("Dati");
    expect(opened.cells[1]![0]).toMatchObject({ kind: "text", input: "00123" });
    expect(opened.cells[1]![2]).toMatchObject({ kind: "formula", input: "=SUM(B2:B3)", value: "9" });
    expect(opened.cells[2]![2]).toMatchObject({ kind: "formula", input: "=C2+B3", value: "14" });
    const edited = editWorkbookCell389(opened, 1, 1, "6", "number");
    expect(edited.cells[1]![2]!.value).toBe("11");
    expect(edited.cells[2]![2]!.value).toBe("16");
    const output = exportXlsxWorkbook389(source, edited);
    const reopened = openXlsxWorkbook389(output);
    expect(reopened.cells[1]![2]).toMatchObject({ kind: "formula", input: "=SUM(B2:B3)", value: "11" });
    expect(reopened.cells[2]![2]!.value).toBe("16");
    const zipped = unzipSync(new Uint8Array(output));
    const xml = decoder.decode(zipped["xl/worksheets/sheet1.xml"]!);
    expect(xml).toMatch(/<f>SUM\(B2:B3\)<\/f><v>11<\/v>/u);
    expect(xml).toMatch(/<f>C2\+B3<\/f><v>16<\/v>/u);
    // Independent Python standard-library ZIP + ElementTree oracle verifies
    // actual worksheet schema/cell positions without sharing our XML reader.
    const python = [
      "import io,json,sys,zipfile,xml.etree.ElementTree as E",
      "with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:",
      " root=E.fromstring(z.read('xl/worksheets/sheet1.xml'))",
      " ns='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'",
      " cells={c.attrib['r']:{'formula':c.findtext(ns+'f'),'value':c.findtext(ns+'v'),'type':c.attrib.get('t')} for c in root.findall('.//'+ns+'c')}",
      " print(json.dumps(cells))",
    ].join("\n");
    const independentSchema = spawnSync("python3", ["-c", python], { input: Buffer.from(output), encoding: "utf8", timeout: 15_000 });
    expect(independentSchema.status, independentSchema.stderr).toBe(0);
    const checked = JSON.parse(independentSchema.stdout) as Record<string, { formula: string | null; value: string | null }>;
    expect(checked["B2"]).toMatchObject({ formula: null, value: "6" });
    expect(checked["C2"]).toMatchObject({ formula: "SUM(B2:B3)", value: "11" });
    expect(checked["C3"]).toMatchObject({ formula: "C2+B3", value: "16" });
    // Independent installed reader sees cached values and source IDs faithfully.
    const independent = await readXlsxFile(output);
    expect(independent[0]!.data[1]).toEqual(["00123", 6, 11]);
    expect(independent[0]!.data[2]).toEqual(["00007", 5, 16]);
  });

  it("rejects unsupported formulas, remote references, cycles, textual dependencies and division by zero", async () => {
    const opened = openXlsxWorkbook389(await realWorkbook());
    expect(() => editWorkbookCell389(opened, 1, 1, "=C2", "formula")).toThrow(/FORMULA_CYCLE/u);
    expect(() => editWorkbookCell389(opened, 1, 2, "=HYPERLINK(\"https:\/\/evil.invalid\")", "formula")).toThrow(/INVALID_FORMULA/u);
    expect(() => editWorkbookCell389(opened, 1, 2, "='https://remote.invalid/[Book.xlsx]Sheet1'!A1", "formula")).toThrow(/INVALID_FORMULA/u);
    expect(() => editWorkbookCell389(opened, 1, 2, "=10/0", "formula")).toThrow(/INVALID_FORMULA/u);
    expect(() => editWorkbookCell389(opened, 1, 2, "=A2+B2", "formula")).toThrow(/INVALID_FORMULA/u);
    expect(() => editWorkbookCell389(opened, 1, 2, "=NOW()", "formula")).toThrow(/INVALID_FORMULA/u);
  });

  it("handles unary signs, precedence and rectangular SUM without evaluating arbitrary code", () => {
    const read = (address: string) => ({ A1: 2, A2: 3, B1: 4, B2: 5 })[address as "A1" | "A2" | "B1" | "B2"] ?? 0;
    expect(computeFormula389("=2+3*4", read)).toBe(14);
    expect(computeFormula389("=-(2+3)*4", read)).toBe(-20);
    expect(computeFormula389("=SUM(A1:B2)*2", read)).toBe(28);
    expect(() => computeFormula389("=SUM(A1:A99999)", read)).toThrow(WorkbookError389);
    expect(() => computeFormula389("=1234567890123456789+1", read)).toThrow(/INVALID_FORMULA/u);
    expect(computeFormula389("=.5+1", read)).toBe(1.5);
  });

  it("preserves explicitly typed formula-looking strings as inert XML text", async () => {
    const source = await realWorkbook();
    const opened = openXlsxWorkbook389(source);
    const literal = editWorkbookCell389(opened, 1, 0, "=HYPERLINK(\"https://example.invalid\")", "text");
    const output = exportXlsxWorkbook389(source, literal);
    expect(openXlsxWorkbook389(output).cells[1]![0]).toMatchObject({ kind: "text", input: '=HYPERLINK("https://example.invalid")' });
    const xml = decoder.decode(unzipSync(new Uint8Array(output))["xl/worksheets/sheet1.xml"]!);
    expect(xml).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;https://example.invalid&quot;)</t></is></c>');
    expect(xml).not.toContain("<f>HYPERLINK");
  });

  it("rejects macros, external relations and advanced workbook structures without emitting altered output", async () => {
    const source = await realWorkbook();
    const withMacro = changeArchive(source, (parts) => {
      parts["[Content_Types].xml"] = encoder.encode(decoder.decode(parts["[Content_Types].xml"]!).replace("spreadsheetml.sheet.main+xml", "ms-excel.sheet.macroEnabled.main+xml"));
    });
    expect(() => openXlsxWorkbook389(withMacro)).toThrow(/macro|MACRO|Macro/u);
    const withRemote = changeArchive(source, (parts) => {
      const path = "xl/_rels/workbook.xml.rels";
      parts[path] = encoder.encode(decoder.decode(parts[path]!).replace("</Relationships>", '<Relationship Id="ext" Target="https://remote.invalid/a.xlsx" TargetMode="External" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink"/></Relationships>'));
    });
    expect(() => openXlsxWorkbook389(withRemote)).toThrow(/remot|estern|Remote/u);
    const styled = changeArchive(source, (parts) => {
      parts["xl/worksheets/sheet1.xml"] = encoder.encode(decoder.decode(parts["xl/worksheets/sheet1.xml"]!).replace('r="B2"', 'r="B2" s="5"'));
    });
    expect(() => openXlsxWorkbook389(styled)).toThrow(/Formato di cella/u);
  });

  it("supports extending a worksheet while preserving typed cells, with deterministic graph recalc", async () => {
    const workbook = openXlsxWorkbook389(await realWorkbook());
    const expanded = expandWorkbook389(expandWorkbook389(workbook, "row"), "column");
    expect(expanded.cells).toHaveLength(4);
    expect(expanded.cells[0]).toHaveLength(4);
    const edit = editWorkbookCell389(expanded, 3, 3, "=SUM(B2:B3)");
    const exported = exportXlsxWorkbook389(await realWorkbook(), edit);
    expect(openXlsxWorkbook389(exported).cells[3]![3]).toMatchObject({ kind: "formula", value: "9" });
  });
});
