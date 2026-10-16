import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { assertSupportedSource237, redactPdfRaster237 } from "../src/engines/pdf/secure-raster-redaction-237";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

const ANNOTATION_MARKER = "MALICIOUS_406_HIDDEN_ANNOTATION";

/** Rewrites the physical classic-xref table after an adversarial local edit;
 * all offsets are real, not inert text with an invented /Prev pointer. */
function withClassicXref406(edit: (body: string) => string, effectivePage = false): Uint8Array {
  const original = Buffer.from(coveredRecoverableSource237()).toString("latin1");
  const tableAt = original.indexOf("\nxref\n");
  if (tableAt < 0 || !original.includes("/Root 6 0 R")) throw Error("The PDF fixture has changed");
  const body = edit(original.slice(0, tableAt + 1));
  const entries = Array.from({ length: 8 }, (_, i) => {
    const id = i + 1;
    const marker = id === 5 && effectivePage ? "\f5 0 obj\n" : `${id} 0 obj\n`;
    // Object syntax inside the visible content stream is not an indirect
    // definition. The actual Catalog follows the content-stream object.
    const position = id === 6 ? body.lastIndexOf(marker) : body.indexOf(marker);
    if (position < 0) throw Error(`Missing object ${id}`);
    if (!(id === 5 && effectivePage) && id !== 6 && body.indexOf(marker, position + 1) >= 0) {
      throw Error(`Nonunique control object ${id}`);
    }
    return position + (id === 5 && effectivePage ? 1 : 0);
  });
  const xref = "xref\n0 9\n0000000000 65535 f \n"
    + entries.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("")
    + "trailer\n<</Size 9 /Root 6 0 R /Info 8 0 R>>\n"
    + `startxref\n${Buffer.byteLength(body, "latin1")}\n%%EOF\n`;
  return Buffer.from(body + xref, "latin1");
}

function hiddenIndexedPage406(): Uint8Array {
  return withClassicXref406((body) => {
    const first = body.indexOf("\n5 0 obj\n");
    const end = body.indexOf("endobj\n", first) + "endobj\n".length;
    if (first < 0 || end < 0) throw Error("Missing original Page5");
    const benign = body.slice(first + 1, end);
    const indexed = benign.replace(/>>\nendobj\n$/u,
      ` /Annots [<< /Type /Annot /Subtype /Text /Rect [0 0 20 20] /Contents (${ANNOTATION_MARKER}) >>] >>\nendobj\n`);
    if (indexed === benign) throw Error("Page5 dictionary not found");
    // Exactly one FF (not a preceding LF) before the effective xref-indexed
    // Page header: the shared parser misses it but genuine readers follow it.
    return body.slice(0, end - 1) + "\f" + indexed + body.slice(end);
  }, true);
}

function ordinaryLiteralHeader406(): Uint8Array {
  return withClassicXref406((body) => {
    const marker = `(${PRIVATE_MARKER_237}) Tj`;
    const content = `(${PRIVATE_MARKER_237}\n6 0 obj\n) Tj`;
    if (!body.includes(marker)) throw Error("Missing original visible PDF text");
    const before = body.indexOf("4 0 obj\n");
    const end = body.indexOf("endobj\n", before);
    const chunk = body.slice(before, end);
    const existing = /\/Length\s+(\d+)/u.exec(chunk);
    if (before < 0 || end < 0 || !existing || !chunk.includes(marker)) throw Error("Missing content stream");
    const increased = chunk.replace(marker, content).replace(/\/Length\s+\d+/u,
      `/Length ${Number(existing[1]) + Buffer.byteLength(content, "latin1") - Buffer.byteLength(marker, "latin1")}`);
    return body.slice(0, before) + increased + body.slice(end);
  });
}

function ordinaryLiteralEndObject406(): Uint8Array {
  return withClassicXref406((body) => {
    const original = `(${PRIVATE_MARKER_237}) Tj`;
    const replacement = `(${PRIVATE_MARKER_237}\nendobj\n) Tj`;
    const start = body.indexOf("4 0 obj\n");
    const finish = body.indexOf("endobj\n", start);
    const chunk = body.slice(start, finish);
    const length = /\/Length\s+(\d+)/u.exec(chunk);
    if (start < 0 || finish < 0 || !length || !chunk.includes(original)) {
      throw Error("Source content stream has changed");
    }
    const increased = chunk.replace(original, replacement).replace(/\/Length\s+\d+/u,
      `/Length ${Number(length[1]) + Buffer.byteLength(replacement, "latin1") - Buffer.byteLength(original, "latin1")}`);
    return body.slice(0, start) + increased + body.slice(finish);
  });
}

const strictPython = [
  "from io import BytesIO",
  "from pypdf import PdfReader",
  "import sys,json,warnings",
  "with warnings.catch_warnings(record=True) as captured:",
  " warnings.simplefilter('always')",
  " doc=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
  " page=doc.pages[0]",
  " annots=page.get('/Annots',[])",
  " annotations=[str(x.get_object().get('/Contents','')) for x in annots]",
  " print(json.dumps({'pages':len(doc.pages),'annotations':annotations,",
  "  'text':''.join(p.extract_text() or '' for p in doc.pages),",
  "  'warnings':[str(w.message) for w in captured]}))",
].join("\n");

function pypdf406(source: Uint8Array): { pages: number; annotations: string[]; text: string; warnings: string[] } {
  return JSON.parse(execFileSync("python3", ["-c", strictPython], {
    input: Buffer.from(source), encoding: "utf8", timeout: 8_000, maxBuffer: 100_000,
  })) as { pages: number; annotations: string[]; text: string; warnings: string[] };
}

function nativeViewers406(source: Uint8Array, annotations: number): void {
  if (execFileSync("python3", ["-c", "import importlib.util;print(bool(importlib.util.find_spec('pypdfium2')))"], {
    encoding: "utf8", timeout: 5_000,
  }).trim() === "True") {
    const python = [
      "from io import BytesIO",
      "import pypdfium2 as pdfium,pypdfium2.raw as raw,sys,json",
      "doc=pdfium.PdfDocument(BytesIO(sys.stdin.buffer.read()))",
      "assert len(doc)==1",
      "page=doc[0]",
      "text=page.get_textpage().get_text_range()",
      "assert 'PRIVATE_237_SOURCE_ONLY_NEVER_OUTPUT_4D792A' in text",
      "thumb=page.render(scale=1)",
      "assert thumb.width==180 and thumb.height==140",
      "print(raw.FPDFPage_GetAnnotCount(page.raw))",
    ].join("\n");
    expect(Number(execFileSync("python3", ["-c", python], {
      input: Buffer.from(source), encoding: "utf8", timeout: 8_000, maxBuffer: 30_000,
    }).trim())).toBe(annotations);
  } else console.warn("PDFIUM_406_NOT_RUN on this host");
  if (process.platform === "darwin") {
    const swift = [
      "import Foundation",
      "import PDFKit",
      "let data = FileHandle.standardInput.readDataToEndOfFile()",
      "guard let doc = PDFDocument(data:data),doc.pageCount==1,let page=doc.page(at:0) else { exit(2) }",
      `guard (doc.string ?? "").contains("${PRIVATE_MARKER_237}") else { exit(3) }`,
      "print(page.annotations.count)",
    ].join("; ");
    expect(Number(execFileSync("swift", ["-e", swift], {
      input: Buffer.from(source), encoding: "utf8", timeout: 60_000, maxBuffer: 30_000,
    }).trim())).toBe(annotations);
  }
}

describe("#406 effective classic xref applies to every PDF object, without scanning inside content", () => {
  it("accepts a real single-revision PDF with a literal endobj token INSIDE a length-bounded content stream", async () => {
    const source = ordinaryLiteralEndObject406();
    const independent = pypdf406(source);
    expect(independent).toMatchObject({ pages: 1, warnings: [], annotations: [] });
    expect(independent.text).toContain("endobj");
    nativeViewers406(source, 0);
    const loader = getDocument({ data: Uint8Array.from(source), disableFontFace: true, useSystemFonts: true });
    try {
      const pdf = await loader.promise;
      expect(pdf.numPages).toBe(1);
      const page = await pdf.getPage(1);
      const text = (await page.getTextContent()).items.map((x) => "str" in x ? x.str : "").join(" ");
      expect(text).toContain(PRIVATE_MARKER_237);
    } finally { await loader.destroy(); }
    expect(assertSupportedSource237(source)).toBe(1);
  }, 25_000);

  it("refuses a real xref-indexed annotated Page5 shadowed by an earlier benign Page5", async () => {
    const source = hiddenIndexedPage406();
    const independent = pypdf406(source);
    expect(independent.pages).toBe(1);
    expect(independent.annotations).toContain(ANNOTATION_MARKER);
    expect(independent.text).toContain(PRIVATE_MARKER_237);
    expect(independent.warnings).toEqual([]);
    nativeViewers406(source, 1);
    const loader = getDocument({ data: Uint8Array.from(source), disableFontFace: true, useSystemFonts: true });
    try {
      const pdf = await loader.promise;
      const annotations = await (await pdf.getPage(1)).getAnnotations();
      expect(annotations.length).toBeGreaterThan(0);
    } finally { await loader.destroy(); }
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
    await expect(redactPdfRaster237(new File([Uint8Array.from(source)], "indexed-page-annot.pdf", { type: "application/pdf" }),
      [{ page: 1, left: 0, top: 0, width: 1, height: 1 }]))
      .rejects.toThrow(/REDACTION_REFUSED/u);
  }, 25_000);

  it("admits a real single-revision PDF with incidental object syntax inside visible text", async () => {
    const source = ordinaryLiteralHeader406();
    const independent = pypdf406(source);
    expect(independent.pages).toBe(1);
    expect(independent.annotations).toHaveLength(0);
    expect(independent.text).toContain("6 0 obj");
    expect(independent.warnings).toEqual([]);
    nativeViewers406(source, 0);
    const loader = getDocument({ data: Uint8Array.from(source), disableFontFace: true, useSystemFonts: true });
    try {
      const pdf = await loader.promise;
      expect(pdf.numPages).toBe(1);
      const text = (await (await pdf.getPage(1)).getTextContent()).items.map((x) => "str" in x ? x.str : "").join(" ");
      // A small source MediaBox can clip the last glyphs in PDF.js extraction,
      // while pypdf independently extracts the complete literal above.
      expect(text).toContain("6 0");
    } finally { await loader.destroy(); }
    expect(assertSupportedSource237(source)).toBe(1);
  }, 25_000);
});
