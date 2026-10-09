import { describe, expect, it } from "vitest";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { previewPdfTable254, exportPdfTableXlsx254, provenanceRows254 } from "../src/engines/pdf/pdf-table-xlsx-254";
import readXlsxFile from "read-excel-file/universal";
import { unzipSync } from "fflate";

export const SAMPLE_254_CELLS = [
  ["Codice", "Valore", "Nota"],
  ["00127", "=2+2", "Formula letterale"],
  ["00009", "42", "+testo"],
] as const;
export const SAMPLE_254_REGION = { x: 0, y: 0, width: 360, height: 400 } as const;

export function fixturePdf254(options: { ruled?: boolean; brokenLine?: boolean; plainText?: boolean } = {}): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const grid: string[] = ["q", "1 w"];
  if (options.ruled !== false) {
    for (const x of [30, 120, 210, 330]) grid.push(`${x} 100 m ${x} 280 l S`);
    for (const y of [100, 160, 220, 280]) grid.push(
      options.brokenLine && y === 220 ? `30 ${y} m 170 ${y} l S` : `30 ${y} m 330 ${y} l S`);
  }
  if (options.plainText) {
    grid.push("BT /F1 16 Tf 30 210 Td (Testo sciolto senza tabella) Tj ET");
  } else for (let row = 0; row < SAMPLE_254_CELLS.length; row++) {
    for (let column = 0; column < SAMPLE_254_CELLS[row]!.length; column++) {
      const text = SAMPLE_254_CELLS[row]![column]!;
      grid.push(`BT /F1 9 Tf ${42 + column * 90} ${246 - row * 60} Td (${text}) Tj ET`);
    }
  }
  grid.push("Q");
  const stream = builder.putAuto({ kind: "stream", dictionary: pdfDict({}),
    bytes: new TextEncoder().encode(grid.join("\n") + "\n") });
  const page = builder.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(360), pdfNumber(400)]),
    Resources: pdfDict({ Font: pdfDict({ F1: font }) }), Contents: stream,
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Count: pdfNumber(1), Kids: pdfArray([page]) }));
  return builder.build(builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages })), null);
}
function namedFile(bytes: Uint8Array, filename = "fatture-001.pdf") {
  return new File([Uint8Array.from(bytes)], filename, { type: "application/pdf" });
}

describe("#254 PDF ruled grid -> XLSX, fail-closed", () => {
  it("previews text grid, provenance and reopens real workbook preserving formula strings and leading zeros", async () => {
    const preview = await previewPdfTable254(namedFile(fixturePdf254()), { page: 1, region: SAMPLE_254_REGION });
    expect(preview).toMatchObject({ rows: 3, columns: 3, sourceFilename: "fatture-001.pdf",
      page: 1, pageHeight: 400, pageWidth: 360 });
    expect(preview.cells).toEqual(SAMPLE_254_CELLS);
    expect(preview.sourceSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(preview.warnings.join(" ")).toMatch(/nessun OCR/iu);
    const workbook = await exportPdfTableXlsx254(preview);
    expect(workbook.bytes[0]).toBe(80);
    expect(workbook.bytes[1]).toBe(75);
    expect(workbook.policy).toBe("text-only-no-formulas-no-ocr");
    const copied = new Uint8Array(new ArrayBuffer(workbook.bytes.byteLength));
    copied.set(workbook.bytes);
    const sheets = await readXlsxFile(copied.buffer);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.sheet).toBe("P01_Griglia");
    expect(sheets[0]?.data.map((row) => row.map((value) => value ?? "")))
      .toEqual(provenanceRows254(preview).map((row) => Array.from({ length: 3 }, (_, c) => row[c] ?? "")));
    expect(sheets[0]?.data[7]?.[0]).toBe("00127");
    expect(sheets[0]?.data[7]?.[1]).toBe("=2+2");
    expect(sheets[0]?.data[8]?.[0]).toBe("00009");
    expect(sheets[0]?.data[8]?.[2]).toBe("+testo");
    const entries = unzipSync(workbook.bytes);
    const xml = new TextDecoder().decode(entries["xl/worksheets/sheet1.xml"]);
    expect(xml).not.toMatch(/<f(?:\s|>)/u);
  });
  it("fails closed on unruled, prose-only, incomplete borders, invalid region and over-limit input", async () => {
    await expect(previewPdfTable254(namedFile(fixturePdf254({ ruled: false })), { page: 1, region: SAMPLE_254_REGION }))
      .rejects.toThrow(/NOT_A_RULED_TABLE/u);
    await expect(previewPdfTable254(namedFile(fixturePdf254({ ruled: false, plainText: true })), { page: 1, region: SAMPLE_254_REGION }))
      .rejects.toThrow(/NOT_A_RULED_TABLE/u);
    await expect(previewPdfTable254(namedFile(fixturePdf254({ brokenLine: true })), { page: 1, region: SAMPLE_254_REGION }))
      .rejects.toThrow(/AMBIGUOUS_GRID/u);
    await expect(previewPdfTable254(namedFile(fixturePdf254()), { page: 1,
      region: { x: 0, y: 0, width: 200, height: 600 } })).rejects.toThrow(/INVALID_REGION/u);
    await expect(previewPdfTable254(namedFile(fixturePdf254()), { page: 2, region: SAMPLE_254_REGION }))
      .rejects.toThrow(/PDF_LIMIT/u);
  });
});
