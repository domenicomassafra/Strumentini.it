import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { assertSupportedSource237, redactPdfRaster237 } from "../src/engines/pdf/secure-raster-redaction-237";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

/**
 * Actual single-revision HYBRID-REFERENCE PDF: classic xref table whose
 * effective trailer points at a binary cross-reference stream via /XRefStm.
 * A harmless PDF comment contains a decoy "trailer <<...>>" after the
 * effective trailer; raw lastIndexOf("trailer") must not determine policy.
 * No source or generic parser implementation is changed to make the fixture.
 */
function hybridWithSingleEof406(): Uint8Array {
  const source = Buffer.from(coveredRecoverableSource237());
  const ascii = source.toString("latin1");
  const final = /startxref\s+(\d+)\s+%%EOF\s*$/u.exec(ascii);
  if (!final) throw new Error("Fixture must have a real startxref");
  const originalXref = Number(final[1]);
  const table = ascii.slice(originalXref).match(/^xref\n0 (\d+)\n((?:\d{10} \d{5} [fn] \n)+)trailer\n<<\s*([^>]+?)\s*>>\nstartxref/u);
  if (!table) throw new Error("Fixture must have one classic xref table");
  const originalSize = Number(table[1]);
  const oldEntries = table[2];
  const originalTrailer = table[3];
  if (!oldEntries || !originalTrailer) throw new Error("Fixture missing xref entries or its effective trailer");
  if (!originalTrailer.includes("/Root") || oldEntries.split("\n").filter(Boolean).length !== originalSize) {
    throw new Error("Fixture classic xref does not cover its declared objects");
  }
  const streamAt = originalXref;
  // 7-byte W=[1 4 2] entry: in-use xref stream object at its real byte offset.
  const entry = Buffer.alloc(7);
  entry[0] = 1;
  entry.writeUInt32BE(streamAt, 1);
  const object = Buffer.concat([
    Buffer.from(`${originalSize} 0 obj\n<< /Type /XRef /Size ${originalSize + 1} /W [1 4 2] /Index [${originalSize} 1] /Length 7 >>\nstream\n`, "ascii"),
    entry,
    Buffer.from("\nendstream\nendobj\n", "ascii"),
  ]);
  const effectiveXref = streamAt + object.length;
  const root = /\/Root\s+(\d+)\s+0\s+R/u.exec(originalTrailer)?.[1];
  const info = /\/Info\s+(\d+)\s+0\s+R/u.exec(originalTrailer)?.[1];
  if (!root) throw new Error("Fixture missing catalog reference");
  const tail = `xref\n0 ${originalSize + 1}\n${oldEntries}${String(streamAt).padStart(10, "0")} 00000 n \n`
    + `trailer\n<< /Size ${originalSize + 1} /Root ${root} 0 R ${info ? `/Info ${info} 0 R ` : ""}/XRefStm ${streamAt} >>\n`
    + `% independent-audit-decoy trailer << /Size ${originalSize + 1} /Root ${root} 0 R >>\n`
    + `startxref\n${effectiveXref}\n%%EOF\n`;
  return Buffer.concat([source.subarray(0, originalXref), object, Buffer.from(tail, "ascii")]);
}

function independentStrictPypdf406(source: Uint8Array): { pages: number; hybridOffset: number; text: string } {
  const py = [
    "from io import BytesIO",
    "from pypdf import PdfReader",
    "import sys,json",
    "r=PdfReader(BytesIO(sys.stdin.buffer.read()), strict=True)",
    "print(json.dumps({'pages':len(r.pages),'hybridOffset':r.trailer.get('/XRefStm',-1),",
    "  'text':''.join(page.extract_text() or '' for page in r.pages)}))",
  ].join("\n");
  return JSON.parse(execFileSync("python3", ["-c", py], {
    input: Buffer.from(source), encoding: "utf8", timeout: 8_000,
    maxBuffer: 100_000, stdio: ["pipe", "pipe", "pipe"],
  })) as { pages: number; hybridOffset: number; text: string };
}

describe("#406 single-revision hybrid/xref stream with decoy trailer", () => {
  it("refuses genuine /XRefStm despite comment masking in-house last-trailer lookup", async () => {
    const source = hybridWithSingleEof406();
    const txt = Buffer.from(source).toString("latin1");
    expect([...txt.matchAll(/(?:^|\n)startxref\s*\n/gu)]).toHaveLength(1);
    expect([...txt.matchAll(/(?:^|\n)%%EOF\s*\n/gu)]).toHaveLength(1);
    expect(txt).toContain("/XRefStm");
    expect(txt).toContain(PRIVATE_MARKER_237);
    const independent = independentStrictPypdf406(source);
    expect(independent.pages).toBe(1);
    expect(independent.hybridOffset).toBeGreaterThan(0);
    expect(independent.text).toContain(PRIVATE_MARKER_237);
    if (process.platform === "darwin") {
      const swift = [
        "import Foundation",
        "import PDFKit",
        "let bytes = FileHandle.standardInput.readDataToEndOfFile()",
        "guard let doc = PDFDocument(data: bytes) else { exit(2) }",
        `print("PDFKIT_406 \\(doc.pageCount) \\((doc.string ?? "").contains("${PRIVATE_MARKER_237}"))")`,
      ].join("; ");
      expect(execFileSync("swift", ["-e", swift], {
        input: Buffer.from(source), encoding: "utf8", timeout: 60_000, maxBuffer: 10_000,
      }).trim()).toBe("PDFKIT_406 1 true");
    }

    const pdfjs = getDocument({ data: Uint8Array.from(source), disableFontFace: true, useSystemFonts: true });
    try {
      const pdf = await pdfjs.promise;
      expect(pdf.numPages).toBe(1);
      const page = await pdf.getPage(1);
      expect((await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(""))
        .toContain(PRIVATE_MARKER_237);
    } finally { await pdfjs.destroy(); }

    expect(() => assertSupportedSource237(source))
      .toThrow(/REDACTION_REFUSED:.*(?:xref|Revisioni|ibrid|Trailer)/iu);
    await expect(redactPdfRaster237(
      new File([Uint8Array.from(source)], "real-hybrid-xrefstm.pdf", { type: "application/pdf" }),
      [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
    )).rejects.toThrow(/REDACTION_REFUSED/u);
  }, 20_000);

  it("keeps an ordinary classic one-revision PDF accepted", () => {
    expect(assertSupportedSource237(coveredRecoverableSource237())).toBe(1);
  });

  it("keeps pre-aborted operations cancelled and a subsequent clean source admissible", async () => {
    const valid = coveredRecoverableSource237();
    const file = new File([Uint8Array.from(valid)], "clean-237.pdf", { type: "application/pdf" });
    const selected = [{ page: 1, left: 0, top: 0, width: 1, height: 1 }] as const;
    const controller = new AbortController();
    controller.abort();
    await expect(redactPdfRaster237(file, selected, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    // A rejected operation must not poison the stateless pre-render source
    // gate used by a fresh retry; actual canvas export is separately covered
    // by the retained #237 browser-forensic suite, not this Node-only test.
    expect(assertSupportedSource237(valid)).toBe(1);
  });
});
