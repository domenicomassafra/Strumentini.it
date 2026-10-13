import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { assertSupportedSource237, redactPdfRaster237 } from "../src/engines/pdf/secure-raster-redaction-237";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

/**
 * The first classic xref and its startxref remain real, but its EOF spelling
 * is incomplete. A subsequent binary xref stream has /Prev pointing back to
 * that classic xref. Both strict pypdf and PDF.js follow the SECOND catalog.
 * There is only one *complete* startxref/%%EOF footer and one classic table.
 */
function incompleteFirstFooterWithRealXrefStream406(): Uint8Array {
  const original = Buffer.from(coveredRecoverableSource237());
  const originalText = original.toString("latin1");
  if (original.length !== 1113 || originalText.indexOf("xref\n0 9\n") !== 860
    || !originalText.endsWith("startxref\n860\n%%EOF\n")) {
    throw new Error("Expected the independently proven one-revision classic fixture");
  }
  const first = Buffer.from(originalText.replace(/%%EOF\n$/u, "%%EOX\n"), "latin1");
  if (first.length !== original.length) throw new Error("First xref offsets must remain unchanged");

  const catalogOffset = first.length;
  const catalog = Buffer.from("9 0 obj\n<< /Type /Catalog /Pages 1 0 R /Lang (it-IT) >>\nendobj\n", "ascii");
  const streamOffset = catalogOffset + catalog.length;
  const xrefEntry = (offset: number): Buffer => {
    const result = Buffer.alloc(7);
    result[0] = 1;
    result.writeUInt32BE(offset, 1);
    return result;
  };
  const streamHeader = Buffer.from(
    "10 0 obj\n<< /Type /XRef /Root 9 0 R /Size 11 /Prev 860 /W [1 4 2] /Index [9 2] /Length 14 >>\nstream\n",
    "ascii",
  );
  const finalFooter = Buffer.from(`\nendstream\nendobj\nstartxref\n${streamOffset}\n%%EOF\n`, "ascii");
  const source = Buffer.concat([
    first, catalog, streamHeader, xrefEntry(catalogOffset), xrefEntry(streamOffset), finalFooter,
  ]);
  const text = source.toString("latin1");
  if (text.indexOf("xref\n0 9\n") !== 860 || !text.includes("/Prev 860")
    || [...text.matchAll(/startxref/gu)].length !== 2
    || [...text.matchAll(/%%EOF/gu)].length !== 1) {
    throw new Error("Hostile xref-stream fixture lost its distinct effective second revision");
  }
  return source;
}

describe("#406 incomplete first footer and live second xref stream", () => {
  it("refuses a true second xref-stream revision independently recognized by strict readers", async () => {
    const hostile = incompleteFirstFooterWithRealXrefStream406();
    const python = [
      "from io import BytesIO",
      "from pypdf import PdfReader",
      "import json,sys,warnings",
      "with warnings.catch_warnings(record=True) as caught:",
      "  warnings.simplefilter('always')",
      "  doc=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
      "  root=doc.trailer['/Root']",
      "  text=''.join(page.extract_text() or '' for page in doc.pages)",
      "  print(json.dumps({'pages':len(doc.pages),'lang':root.get('/Lang'),",
      "    'text':text,'warnings':[str(w.message) for w in caught]}))",
    ].join("\n");
    const result = JSON.parse(execFileSync("python3", ["-c", python], {
      input: Buffer.from(hostile), encoding: "utf8", timeout: 8000,
      maxBuffer: 100000, stdio: ["pipe", "pipe", "pipe"],
    })) as { pages: number; lang: string; text: string; warnings: string[] };
    expect(result).toMatchObject({ pages: 1, lang: "it-IT", warnings: [] });
    expect(result.text).toContain(PRIVATE_MARKER_237);

    const loader = getDocument({ data: Uint8Array.from(hostile), disableFontFace: true, useSystemFonts: true });
    try {
      const pdf = await loader.promise;
      expect(pdf.numPages).toBe(1);
      const { info } = await pdf.getMetadata();
      expect("Language" in info ? info.Language : undefined).toBe("it-IT");
      const page = await pdf.getPage(1);
      expect((await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(""))
        .toContain(PRIVATE_MARKER_237);
    } finally { await loader.destroy(); }

    expect(() => assertSupportedSource237(hostile))
      .toThrow(/REDACTION_REFUSED:.*(?:xref|Revisioni|Puntatore)/iu);
    await expect(redactPdfRaster237(
      new File([Uint8Array.from(hostile)], "incomplete-footer-real-xref-stream.pdf", { type: "application/pdf" }),
      [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
    )).rejects.toThrow(/REDACTION_REFUSED/u);
  }, 25000);

  it("still accepts the same source as a genuine, ordinary single classic revision", () => {
    expect(assertSupportedSource237(coveredRecoverableSource237())).toBe(1);
  });
});
