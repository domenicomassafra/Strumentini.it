import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";
import { createSimplePdf } from "../src/engines/pdf";
import { pdfToDocx57 } from "../src/engines/pdf/pdf-to-docx-57";

const asPdf = (bytes: Uint8Array, name = "str420.pdf") =>
  new File([Uint8Array.from(bytes)], name, { type: "application/pdf" });

async function ruledTable(): Promise<File> {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const x of [70, 185, 300]) {
    page.drawLine({ start: { x, y: 540 }, end: { x, y: 620 }, thickness: 1, color: rgb(0, 0, 0) });
  }
  for (const y of [540, 580, 620]) {
    page.drawLine({ start: { x: 70, y }, end: { x: 300, y }, thickness: 1, color: rgb(0, 0, 0) });
  }
  for (const [value, x, y] of [
    ["Codice", 81, 596], ["Nome", 196, 596],
    ["001", 81, 556], ["Alice", 196, 556],
  ] as const) page.drawText(value, { x, y, size: 12, font });
  return asPdf(await document.save({ useObjectStreams: false }));
}

async function columns(): Promise<File> {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText("colonna sinistra", { x: 50, y: 680, font });
  page.drawText("colonna destra", { x: 340, y: 680, font });
  return asPdf(await document.save({ useObjectStreams: false }));
}

async function staggeredColumns(): Promise<File> {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const [text, x, y] of [
    ["Sinistra prima riga", 50, 700],
    ["Sinistra seconda riga", 50, 672],
    ["Destra prima riga", 340, 688],
    ["Destra seconda riga", 340, 660],
  ] as const) page.drawText(text, { x, y, size: 12, font });
  return asPdf(await document.save({ useObjectStreams: false }));
}

async function imageWithText(): Promise<File> {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText("visibile", { x: 50, y: 680, font });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");
  page.drawImage(await document.embedPng(png), { x: 80, y: 530, width: 40, height: 40 });
  return asPdf(await document.save({ useObjectStreams: false }));
}

// Independent consumer: CPython ZIP/XML parser, entirely separate from the
// writer docx and the production TypeScript OOXML semantic reader.
const independent = [
  "import io,json,sys,zipfile,xml.etree.ElementTree as ET",
  "source = sys.stdin.buffer.read()",
  "z = zipfile.ZipFile(io.BytesIO(source))",
  "xml = z.read('word/document.xml')",
  "root = ET.fromstring(xml)",
  "w = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'",
  "body = root.find(w+'body')",
  "paragraphs = [e for e in body if e.tag == w+'p']",
  "tables = [e for e in body if e.tag == w+'tbl']",
  "text = lambda e: ''.join(t.text or '' for t in e.iter(w+'t'))",
  "grid = [[[text(cell) for cell in row.findall(w+'tc')] for row in tab.findall(w+'tr')] for tab in tables]",
  "section = body.find(w+'sectPr')",
  "size = section.find(w+'pgSz')",
  "size_pts = [int(size.attrib[w+'w']) / 20, int(size.attrib[w+'h']) / 20]",
  "breaks = sum(bool(p.find('.//'+w+'pageBreakBefore') is not None) for p in paragraphs)",
  "first = next(t for t in root.iter(w+'t') if t.text)",
  "before = first.text",
  "first.text = 'MODIFIED_BY_EXTERNAL_CONSUMER'",
  "changed = ET.tostring(root, encoding='utf-8', xml_declaration=True)",
  "out = io.BytesIO()",
  "with zipfile.ZipFile(out, 'w') as edited:",
  "  for member in z.namelist():",
  "    edited.writestr(member, changed if member == 'word/document.xml' else z.read(member))",
  "with zipfile.ZipFile(io.BytesIO(out.getvalue())) as reopened:",
  "  modified = ET.fromstring(reopened.read('word/document.xml'))",
  "  editable = any(t.text == 'MODIFIED_BY_EXTERNAL_CONSUMER' for t in modified.iter(w+'t'))",
  "print(json.dumps({'paragraphs':[text(p) for p in paragraphs], 'tables':grid, 'pageSizePt':size_pts, 'pageBreaks':breaks, 'editable':editable, 'previousText':before}))",
].join("\n");
function reopenIndependently(bytes: Uint8Array) {
  const result = spawnSync("python3", ["-c", independent], { input: Buffer.from(bytes), encoding: "utf8", timeout: 15000 });
  if (result.status !== 0) throw new Error(result.stderr || "Independent DOCX reopen failed");
  return JSON.parse(result.stdout) as {
    paragraphs: string[]; tables: string[][][]; pageSizePt: number[]; pageBreaks: number; editable: boolean;
  };
}

describe("STR-420 PDF -> editable Word semantic feasibility", () => {
  it("reopens and edits paragraph runs in a different DOCX consumer, compares page geometry and page breaks", async () => {
    const input = asPdf(createSimplePdf(["uno & <due>", "seconda pagina"]));
    const result = await pdfToDocx57(input);
    const reopened = reopenIndependently(result.bytes);
    expect(reopened.editable).toBe(true);
    expect(reopened.paragraphs).toContain("uno & <due>");
    expect(reopened.paragraphs).toContain("seconda pagina");
    expect(reopened.tables).toHaveLength(0);
    expect(reopened.pageBreaks).toBe(1);
    // Independent structural layout diff in points, not a claim of pixel fidelity.
    expect(Math.abs(reopened.pageSizePt[0]! - 612)).toBeLessThan(1);
    expect(Math.abs(reopened.pageSizePt[1]! - 792)).toBeLessThan(1);
    expect(result.policy).toBe("editable-text-and-ruled-tables-no-faithful-layout");
  });

  it("reconstructs a genuine Word table with editable cells, independently compared row and column layout", async () => {
    const result = await pdfToDocx57(await ruledTable());
    const reopened = reopenIndependently(result.bytes);
    expect(result.tableCount).toBe(1);
    expect(reopened.tables).toEqual([[["Codice", "Nome"], ["001", "Alice"]]]);
    expect(reopened.editable).toBe(true);
    expect(reopened.pageSizePt.map(Math.round)).toEqual([595, 842]);
    const zipped = unzipSync(result.bytes);
    const xml = strFromU8(zipped["word/document.xml"]!);
    expect(xml).toContain("<w:tbl>");
    expect(xml).not.toContain("<w:drawing>");
    expect(xml).not.toContain("w:pict");
  });

  it("refuses multicols, image pages, scanned pages and incomplete graphics as semantic reconstruction", async () => {
    await expect(pdfToDocx57(await columns())).rejects.toThrow(/PDF420_COLUMNS_UNSUPPORTED/u);
    await expect(pdfToDocx57(await staggeredColumns())).rejects.toThrow(/PDF420_COLUMNS_UNSUPPORTED/u);
    await expect(pdfToDocx57(await imageWithText())).rejects.toThrow(/PDF420_IMAGE_UNSUPPORTED/u);
    await expect(pdfToDocx57(asPdf(createSimplePdf([""])))).rejects.toThrow(/PDF57_OCR_REQUIRED/u);
    const noGrid = await PDFDocument.create();
    const page = noGrid.addPage([595, 842]);
    const font = await noGrid.embedFont(StandardFonts.Helvetica);
    page.drawText("non-table", { x: 50, y: 680, font });
    page.drawLine({ start: { x: 50, y: 660 }, end: { x: 200, y: 660 } });
    await expect(pdfToDocx57(asPdf(await noGrid.save()))).rejects.toThrow(/PDF420_LAYOUT_UNSUPPORTED/u);
  });
});
