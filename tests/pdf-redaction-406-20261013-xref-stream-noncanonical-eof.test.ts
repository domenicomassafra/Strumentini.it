import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { assertSupportedSource237, redactPdfRaster237 } from "../src/engines/pdf/secure-raster-redaction-237";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

/** True classic first revision and actual second binary cross-reference stream.
 * Only the last %%EOF line varies: strict pypdf and PDF.js can still follow
 * the second /Root when the final footer is not recognized by the source gate.
 */
function secondRevisionWithFooter406(endMarker: string): Uint8Array {
  const first = Buffer.from(coveredRecoverableSource237());
  const text = first.toString("latin1");
  if (first.length !== 1113 || text.indexOf("xref\n0 9\n") !== 860
    || !text.endsWith("startxref\n860\n%%EOF\n")) {
    throw new Error("The independently checked classic PDF fixture has changed");
  }
  const catalog = Buffer.from("9 0 obj\n<< /Type /Catalog /Pages 1 0 R /Lang (it-IT) >>\nendobj\n", "ascii");
  const streamOffset = first.length + catalog.length;
  const references = Buffer.alloc(14);
  references[0] = 1;
  references.writeUInt32BE(first.length, 1);
  references[7] = 1;
  references.writeUInt32BE(streamOffset, 8);
  const stream = Buffer.from(
    "10 0 obj\n<< /Type /XRef /Root 9 0 R /Size 11 /Prev 860 /W [1 4 2] /Index [9 2] /Length 14 >>\nstream\n",
    "ascii",
  );
  const tail = Buffer.from(
    `\nendstream\nendobj\nstartxref\n${streamOffset}\n${endMarker}\n`,
    "latin1",
  );
  const output = Buffer.concat([first, catalog, stream, references, tail]);
  if (output.indexOf(Buffer.from("/Prev 860")) < 0 || streamOffset !== 1176
    || !output.toString("latin1").includes(`startxref\n${streamOffset}\n`)) {
    throw new Error("The genuine final xref stream and its byte pointers must remain intact");
  }
  return output;
}

const strictPypdf = [
  "from io import BytesIO",
  "from pypdf import PdfReader",
  "import json,sys,warnings",
  "with warnings.catch_warnings(record=True) as captured:",
  "  warnings.simplefilter('always')",
  "  pdf=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
  "  print(json.dumps({'pages':len(pdf.pages),'lang':pdf.trailer['/Root'].get('/Lang'),",
  "    'text':''.join(page.extract_text() or '' for page in pdf.pages),",
  "    'warnings':[str(w.message) for w in captured]}))",
].join("\n");

async function independentReaders406(source: Uint8Array): Promise<void> {
  const pypdf = JSON.parse(execFileSync("python3", ["-c", strictPypdf], {
    input: Buffer.from(source), encoding: "utf8", timeout: 8_000, maxBuffer: 100_000,
    stdio: ["pipe", "pipe", "pipe"],
  })) as { pages: number; lang: string; text: string; warnings: string[] };
  expect(pypdf).toMatchObject({ pages: 1, lang: "it-IT", warnings: [] });
  expect(pypdf.text).toContain(PRIVATE_MARKER_237);
  const loader = getDocument({ data: Uint8Array.from(source), disableFontFace: true, useSystemFonts: true });
  try {
    const pdf = await loader.promise;
    expect(pdf.numPages).toBe(1);
    const { info } = await pdf.getMetadata();
    expect("Language" in info ? info.Language : undefined).toBe("it-IT");
    const page = await pdf.getPage(1);
    expect((await page.getTextContent()).items.map(item => "str" in item ? item.str : "").join(""))
      .toContain(PRIVATE_MARKER_237);
  } finally { await loader.destroy(); }
}

describe("#406 appended real xref stream with noncanonical final EOF", () => {
  for (const [label, marker] of [
    ["EOF followed by same-line comment", "%%EOF%comment"],
    ["EOF with trailing characters", "%%EOFjunk"],
    ["EOF followed by vertical tab", "%%EOF\v"],
  ] as const) {
    it(`refuses true second xref stream with ${label} recognized by independent readers`, async () => {
      const source = secondRevisionWithFooter406(marker);
      expect([...Buffer.from(source).toString("latin1").matchAll(/(?:^|\n)%%EOF\n/gu)]).toHaveLength(1);
      await independentReaders406(source);
      expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
      await expect(redactPdfRaster237(
        new File([Uint8Array.from(source)], "true-second-stream.pdf", { type: "application/pdf" }),
        [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
      )).rejects.toThrow(/REDACTION_REFUSED/u);
    }, 25_000);
  }

  it("accepts an ordinary one-revision classic PDF with harmless trailing PDF comments", () => {
    const classic = Buffer.from(coveredRecoverableSource237());
    const trailing = Buffer.concat([
      classic,
      Buffer.from("% benign source note with startxref text (no numeric declaration)\n", "ascii"),
    ]);
    expect(assertSupportedSource237(classic)).toBe(1);
    expect(assertSupportedSource237(trailing)).toBe(1);
  });
});
