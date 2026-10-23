import { describe, expect, it } from "vitest";
import { unzipSync, zipSync } from "fflate";
import writeXlsxFile from "write-excel-file/universal";
import { editWorkbookCell389 } from "../src/engines/table/workbook-formulas-389";
import { exportXlsxWorkbook389, openXlsxWorkbook389 } from "../src/engines/table/workbook-xlsx-389";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

async function fixture(): Promise<ArrayBuffer> {
  const blob = await writeXlsxFile([{
    sheet: "Dati",
    data: [
      [{ value: "ID", type: String }, { value: "Valore", type: String }],
      [{ value: "0009", type: String }, { value: 4, type: Number }],
    ],
  }]).toBlob();
  return blob.arrayBuffer();
}

function mutate(source: ArrayBuffer, name: string, change: (xml: string) => string): ArrayBuffer {
  const entries = unzipSync(new Uint8Array(source));
  const original = decoder.decode(entries[name]!);
  const altered = change(original);
  expect(altered).not.toBe(original);
  entries[name] = encoder.encode(altered);
  const result = zipSync(entries);
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer;
}

describe("STR-389 explicit workbook exclusions", () => {
  it("refuses macro-enabled packages before editing, preserving the caller's original bytes", async () => {
    const original = await fixture();
    const snapshot = Buffer.from(original);
    const macro = mutate(original, "[Content_Types].xml", (xml) =>
      xml.replace("spreadsheetml.sheet.main+xml", "ms-excel.sheet.macroEnabled.main+xml"));
    expect(() => openXlsxWorkbook389(macro)).toThrow(/UNSUPPORTED_WORKBOOK|Macro|macro/u);
    expect(Buffer.from(original)).toEqual(snapshot);
  });

  it("refuses external workbook links and remote relationship targets", async () => {
    const original = await fixture();
    const remote = mutate(original, "xl/_rels/workbook.xml.rels", (xml) => xml.replace(
      "</Relationships>",
      '<Relationship Id="rRemote" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="https://remote.invalid/data.xlsx" TargetMode="External"/></Relationships>',
    ));
    expect(() => openXlsxWorkbook389(remote)).toThrow(/UNSUPPORTED_WORKBOOK/u);
    const opened = openXlsxWorkbook389(original);
    expect(() => editWorkbookCell389(opened, 1, 1, "=[Remote.xlsx]Sheet1!A1", "formula"))
      .toThrow(/INVALID_FORMULA/u);
  });

  it("refuses unsupported OOXML constructs and never produces a partially rewritten file", async () => {
    const original = await fixture();
    const advanced = mutate(original, "xl/worksheets/sheet1.xml", (xml) =>
      xml.replace("</worksheet>", '<conditionalFormatting sqref="B2"><cfRule type="expression" priority="1"><formula>1</formula></cfRule></conditionalFormatting></worksheet>'));
    expect(() => openXlsxWorkbook389(advanced)).toThrow(/UNSUPPORTED_WORKBOOK/u);
    expect(() => exportXlsxWorkbook389(advanced, openXlsxWorkbook389(original))).toThrow(/UNSUPPORTED_WORKBOOK/u);
    expect(openXlsxWorkbook389(original).cells[1]![0]).toMatchObject({ kind: "text", input: "0009" });
  });
});
