import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { assertSupportedSource237, redactPdfRaster237 } from "../src/engines/pdf/secure-raster-redaction-237";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

/** A legal PDF form feed separates the real, xref-indexed Catalog header from
 * the previous object. A text-scanning parser can skip it while real PDF
 * viewers still resolve the signed-looking catalog through the xref offset.
 */
function formfeedSignedCatalog406(withDecoy = false, paddedSignedId = false): Uint8Array {
  const original = Buffer.from(coveredRecoverableSource237()).toString("latin1");
  const xref = original.indexOf("\nxref\n");
  const oldCatalog = "\n6 0 obj\n<</Type /Catalog /Pages 1 0 R>>";
  const newCatalog = `\f${paddedSignedId ? "06" : "6"} 0 obj\n<</Type /Catalog /Pages 1 0 R /Perms <</DocMDP <</Type /Sig /ByteRange [0 1 2 3]>>>>>>`;
  if (xref < 0 || !original.slice(0, xref).includes(oldCatalog)) {
    throw new Error("The original independently readable PDF fixture changed");
  }
  const decoy = "\n6 0 obj\n<</Type /Catalog /Pages 1 0 R>>\nendobj";
  const body = original.slice(0, xref + 1).replace(oldCatalog, (withDecoy ? decoy : "") + newCatalog);
  const offsets = Array.from({ length: 8 }, (_, index) => {
    const header = `${index + 1} 0 obj\n`;
    // A decoy Catalog is deliberately unreferenced. The independently active
    // xref still points at the later signed-looking Catalog after form feed.
    const at = withDecoy && index === 5
      ? paddedSignedId ? body.lastIndexOf("\f06 0 obj\n") + 1 : body.lastIndexOf(header)
      : body.indexOf(header);
    if (at < 0 || (!withDecoy || index !== 5) && body.indexOf(header, at + 1) >= 0) {
      throw new Error("Ambiguous object header in source fixture");
    }
    return at;
  });
  const table = "xref\n0 9\n0000000000 65535 f \n"
    + offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("")
    + "trailer\n<</Size 9 /Root 6 0 R /Info 8 0 R>>\n"
    + `startxref\n${Buffer.byteLength(body, "latin1")}\n%%EOF\n`;
  return Buffer.from(body + table, "latin1");
}

function independentPdfium406(source: Uint8Array): void {
  // PDFium is optional in CI: run a real native PDFium text/thumbnail reopen
  // when installed, and preserve an explicit NOT_RUN on hosts without it.
  const installed = execFileSync("python3", ["-c", "import importlib.util;print(int(importlib.util.find_spec('pypdfium2') is not None))"], {
    encoding: "utf8", timeout: 5_000,
  }).trim() === "1";
  if (!installed) {
    console.warn("PDFIUM_406_NOT_RUN: native pypdfium2 is unavailable on this host");
    return;
  }
  const python = [
    "from io import BytesIO",
    "import sys,pypdfium2",
    "pdf=pypdfium2.PdfDocument(BytesIO(sys.stdin.buffer.read()))",
    "assert len(pdf)==1",
    "page=pdf[0]",
    `assert '${PRIVATE_MARKER_237}' in page.get_textpage().get_text_range()`,
    "thumbnail=page.render(scale=1)",
    "assert thumbnail.width==180 and thumbnail.height==140",
    "print('PDFIUM_406_SOURCE_TEXT_THUMBNAIL_PASS')",
  ].join("\n");
  expect(execFileSync("python3", ["-c", python], {
    input: Buffer.from(source), encoding: "utf8", timeout: 8_000,
    maxBuffer: 50_000,
  }).trim()).toBe("PDFIUM_406_SOURCE_TEXT_THUMBNAIL_PASS");
}

function independentPdfKit406(source: Uint8Array): void {
  if (process.platform !== "darwin") return;
  const swift = [
    "import Foundation",
    "import PDFKit",
    "let bytes = FileHandle.standardInput.readDataToEndOfFile()",
    "guard let pdf = PDFDocument(data: bytes), pdf.pageCount == 1 else { exit(2) }",
    `guard (pdf.string ?? "").contains("${PRIVATE_MARKER_237}") else { exit(3) }`,
    "print(\"PDFKIT_406_CATALOG_REOPEN_PASS\")",
  ].join("; ");
  expect(execFileSync("swift", ["-e", swift], {
    input: Buffer.from(source), encoding: "utf8", timeout: 60_000, maxBuffer: 50_000,
  }).trim()).toBe("PDFKIT_406_CATALOG_REOPEN_PASS");
}

async function independentPdfJs406(source: Uint8Array): Promise<void> {
  const loader = getDocument({ data: Uint8Array.from(source), disableFontFace: true, useSystemFonts: true });
  try {
    const pdf = await loader.promise;
    expect(pdf.numPages).toBe(1);
    const page = await pdf.getPage(1);
    const recovered = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join("");
    expect(recovered).toContain(PRIVATE_MARKER_237);
  } finally { await loader.destroy(); }
}

describe("#406 legitimate xref Catalog hidden from internal text scan by PDF form feed", () => {
  it("refuses the signed/certified-looking source actually resolved by strict external readers", async () => {
    const source = formfeedSignedCatalog406();
    const strictPy = [
      "from io import BytesIO",
      "from pypdf import PdfReader",
      "import sys,json,warnings",
      "with warnings.catch_warnings(record=True) as warnings_seen:",
      " warnings.simplefilter('always')",
      " pdf=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
      " root=pdf.trailer['/Root']",
      " signed=root['/Perms']['/DocMDP']",
      " print(json.dumps({'pages':len(pdf.pages),'signedType':str(signed['/Type']),",
      "  'hasByteRange':len(signed['/ByteRange'])==4,",
      "  'sourceText':''.join(page.extract_text() or '' for page in pdf.pages),",
      "  'warnings':[str(w.message) for w in warnings_seen]}))",
    ].join("\n");
    const strict = JSON.parse(execFileSync("python3", ["-c", strictPy], {
      input: Buffer.from(source), encoding: "utf8", timeout: 8_000,
      maxBuffer: 100_000, stdio: ["pipe", "pipe", "pipe"],
    })) as { pages: number; signedType: string; hasByteRange: boolean; sourceText: string; warnings: string[] };
    expect(strict).toMatchObject({ pages: 1, signedType: "/Sig", hasByteRange: true, warnings: [] });
    expect(strict.sourceText).toContain(PRIVATE_MARKER_237);
    independentPdfium406(source);
    independentPdfKit406(source);
    await independentPdfJs406(source);

    // No PDF should be emitted after independent readers see signed content.
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
    await expect(redactPdfRaster237(
      new File([Uint8Array.from(source)], "formfeed-signed-catalog.pdf", { type: "application/pdf" }),
      [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
    )).rejects.toThrow(/REDACTION_REFUSED/u);
  }, 25_000);

  it("still admits the same ordinary one-revision classic document", () => {
    expect(assertSupportedSource237(coveredRecoverableSource237())).toBe(1);
  });

  it("refuses an unreferenced decoy Catalog whose number shadows the effective signed Catalog", async () => {
    const source = formfeedSignedCatalog406(true);
    const strictPy = [
      "from io import BytesIO",
      "from pypdf import PdfReader",
      "import sys",
      "pdf=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
      "assert len(pdf.pages)==1",
      "assert pdf.trailer['/Root']['/Perms']['/DocMDP']['/Type']=='/Sig'",
      "print('SIGNED_CATALOG_FROM_EFFECTIVE_XREF')",
    ].join("\n");
    expect(execFileSync("python3", ["-c", strictPy], {
      input: Buffer.from(source), encoding: "utf8", timeout: 8_000, maxBuffer: 30_000,
    }).trim()).toBe("SIGNED_CATALOG_FROM_EFFECTIVE_XREF");
    independentPdfium406(source);
    independentPdfKit406(source);
    await independentPdfJs406(source);
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
    await expect(redactPdfRaster237(
      new File([Uint8Array.from(source)], "decoy-catalog-before-signed.pdf", { type: "application/pdf" }),
      [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
    )).rejects.toThrow(/REDACTION_REFUSED/u);
  });

  it("binds the active Catalog to its xref offset even when alternate integer spelling evades literal header counting", async () => {
    // "06" and "6" denote the same PDF object number. Only the first is
    // xref-indexed; a text-scanning lookup instead sees the benign "6" first.
    const source = formfeedSignedCatalog406(true, true);
    const strictPy = [
      "from io import BytesIO",
      "from pypdf import PdfReader",
      "import sys",
      "pdf=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
      "assert len(pdf.pages)==1",
      "assert pdf.trailer['/Root']['/Perms']['/DocMDP']['/Type']=='/Sig'",
      "print('XREF_INDEXED_PADDED_SIGNED_CATALOG')",
    ].join("\n");
    expect(execFileSync("python3", ["-c", strictPy], {
      input: Buffer.from(source), encoding: "utf8", timeout: 8_000, maxBuffer: 30_000,
    }).trim()).toBe("XREF_INDEXED_PADDED_SIGNED_CATALOG");
    independentPdfium406(source);
    independentPdfKit406(source);
    await independentPdfJs406(source);
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
  });
});
