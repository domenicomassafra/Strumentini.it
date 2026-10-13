import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parsePdf } from "../src/engines/pdf/parser";
import { assertSupportedSource237, redactPdfRaster237 } from "../src/engines/pdf/secure-raster-redaction-237";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

/** Real 1-revision classic PDF with known actual xref offsets (not a PDF mock). */
const source = Buffer.from(coveredRecoverableSource237());
const sourceText = source.toString("latin1");
const originalXref = /startxref\n(\d+)\n%%EOF\n$/u.exec(sourceText)?.[1];
const originalTable = /(?:^|\n)xref\n0 (\d+)\n((?:\d{10} \d{5} [fn] \n)+)trailer\n/u.exec(sourceText);
if (source.length !== 1113 || originalXref !== "860" || originalTable?.[1] !== "9" || !originalTable[2]
  || originalTable[2].split("\n").filter(Boolean).length !== 9) {
  throw new Error("#406 CR-only regression requires the proven original 1113-byte classic-xref fixture");
}

function withFirstFooter(replacement: string): Uint8Array {
  const altered = sourceText.replace(/startxref\n860\n%%EOF\n$/u, replacement);
  if (!sourceText.endsWith("startxref\n860\n%%EOF\n") || altered.length !== sourceText.length) {
    throw new Error("#406 first revision and its xref offsets must be unchanged");
  }
  return Buffer.from(altered, "latin1");
}

function originalWithFirstFooter(lineEnding: "\n" | "\r"): Uint8Array {
  return withFirstFooter(`startxref${lineEnding}860${lineEnding}%%EOF${lineEnding}`);
}

function appendRealSecondRevision(first: Uint8Array): Uint8Array {
  // A different Catalog and a complete 0..9 classic xref table, with an
  // effective new /Root and no /Prev. Both revisions are strict-reader valid.
  const nextCatalogOffset = first.length;
  const catalog = `9 0 obj\n<< /Type /Catalog /Pages 1 0 R /Lang (it-IT) >>\nendobj\n`;
  const secondXrefOffset = nextCatalogOffset + Buffer.byteLength(catalog, "latin1");
  const tail = `xref\n0 10\n${originalTable![2]}${String(nextCatalogOffset).padStart(10, "0")} 00000 n \n`
    + "trailer\n<< /Size 10 /Root 9 0 R /Info 8 0 R >>\n"
    + `startxref\n${secondXrefOffset}\n%%EOF\n`;
  return Buffer.concat([Buffer.from(first), Buffer.from(catalog + tail, "latin1")]);
}

const python = [
  "from io import BytesIO",
  "from pypdf import PdfReader",
  "import json,sys,warnings,logging",
  "with warnings.catch_warnings(record=True) as recorded:",
  "  warnings.simplefilter('always')",
  "  reader=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
  "  root=reader.trailer['/Root']",
  "  text=''.join(p.extract_text() or '' for p in reader.pages)",
  "  print(json.dumps({'pages':len(reader.pages),'language':str(root.get('/Lang','')),'text':text,'warnings':[str(w.message) for w in recorded]}))",
].join("\n");

async function independentConsumers(bytes: Uint8Array): Promise<{ language: string; text: string }> {
  const result = execFileSync("python3", ["-c", python], {
    input: Buffer.from(bytes), encoding: "utf8", timeout: 8000, maxBuffer: 100000,
  });
  const py = JSON.parse(result) as { pages: number; language: string; text: string; warnings: string[] };
  expect(py).toMatchObject({ pages: 1, warnings: [] });
  expect(py.text).toContain(PRIVATE_MARKER_237);
  const loader = getDocument({ data: Uint8Array.from(bytes), disableFontFace: true, useSystemFonts: true });
  try {
    const doc = await loader.promise;
    expect(doc.numPages).toBe(1);
    const { info } = await doc.getMetadata();
    const language = "Language" in info && typeof info.Language === "string" ? info.Language : "";
    expect(language).toBe(py.language);
    const page = await doc.getPage(1);
    expect((await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(""))
      .toContain(PRIVATE_MARKER_237);
  } finally { await loader.destroy(); }
  return { language: py.language, text: py.text };
}

describe("#406 review P1: CR-only first-revision terminators must not hide extra revisions", () => {
  it("refuses two strict-PDF-valid revisions when the FIRST footer uses CR-only line endings", async () => {
    const initial = originalWithFirstFooter("\r");
    const final = appendRealSecondRevision(initial);
    expect(initial.length).toBe(1113);
    expect(final.length).toBeLessThan(2_000);
    expect([...Buffer.from(final).toString("latin1").matchAll(/startxref/gu)]).toHaveLength(2);
    expect([...Buffer.from(final).toString("latin1").matchAll(/%%EOF/gu)]).toHaveLength(2);
    expect((await independentConsumers(initial)).language).toBe("");
    expect((await independentConsumers(final)).language).toBe("it-IT");
    expect(() => assertSupportedSource237(final)).toThrow(/REDACTION_REFUSED: Revisioni incrementali/u);
    await expect(redactPdfRaster237(
      new File([Uint8Array.from(final)], "dual-revision-cr-first.pdf", { type: "application/pdf" }),
      [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
    )).rejects.toThrow(/REDACTION_REFUSED/u);
  }, 25_000);

  it("refuses the same dual revision when the FIRST footer has ordinary LF endings", async () => {
    const full = appendRealSecondRevision(originalWithFirstFooter("\n"));
    expect((await independentConsumers(full)).language).toBe("it-IT");
    expect(() => assertSupportedSource237(full)).toThrow(/REDACTION_REFUSED: Revisioni incrementali/u);
  }, 20_000);

  it("admits a single classic revision with a strict-pypdf-valid CR-only footer", async () => {
    const valid = originalWithFirstFooter("\r");
    expect((await independentConsumers(valid)).language).toBe("");
    expect(parsePdf(valid).pages).toHaveLength(1);
    expect(assertSupportedSource237(valid)).toBe(1);
  }, 20_000);

  for (const [label, firstFooter] of [
    ["TAB", "startxref\t860\n%%EOF\t"],
    ["space", "startxref 860\n%%EOF "],
    ["form feed", "startxref\f860\n%%EOF\f"],
  ] as const) {
    it(`counts hidden first-revision ${label} delimiters rather than accepting a second revision`, async () => {
      const first = withFirstFooter(firstFooter);
      const twoRevisions = appendRealSecondRevision(first);
      expect(first.length).toBe(1113);
      expect((await independentConsumers(first)).language).toBe("");
      expect((await independentConsumers(twoRevisions)).language).toBe("it-IT");
      // A standalone same-line TAB/space/FF offset can require permissive
      // fallback in pypdf, so the local *admission* remains conservative;
      // independent strict pypdf and PDF.js do follow the second revision.
      expect(() => assertSupportedSource237(twoRevisions))
        .toThrow(/REDACTION_REFUSED: Revisioni incrementali/u);
    }, 25_000);
  }
});
