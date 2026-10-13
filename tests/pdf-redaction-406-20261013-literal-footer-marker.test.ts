import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parsePdf } from "../src/engines/pdf/parser";
import { assertSupportedSource237 } from "../src/engines/pdf/secure-raster-redaction-237";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

const canonical = Buffer.from(coveredRecoverableSource237()).toString("latin1");
const originalXref = canonical.indexOf("xref\n0 9\n");
if (canonical.length !== 1113 || originalXref !== 860
  || !canonical.includes(`(${PRIVATE_MARKER_237}) Tj`)) {
  throw new Error("#406 independent PDF regression must retain genuine classic xref offsets");
}

function visibleText406(text: string): Uint8Array {
  if (text.length > PRIVATE_MARKER_237.length) throw Error("Replacement must preserve byte offsets");
  const replacement = text.padEnd(PRIVATE_MARKER_237.length, "_");
  const bytes = canonical.replace(`(${PRIVATE_MARKER_237}) Tj`, `(${replacement}) Tj`);
  if (bytes.length !== canonical.length || bytes === canonical || bytes.indexOf("xref\n0 9\n") !== 860) {
    throw Error("The independent redaction fixture xref offsets have changed");
  }
  return Buffer.from(bytes, "latin1");
}

const strictPypdf = [
  "from io import BytesIO",
  "from pypdf import PdfReader",
  "import json,sys,warnings",
  "with warnings.catch_warnings(record=True) as caught:",
  "  warnings.simplefilter('always')",
  "  doc=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
  "  print(json.dumps({'pages':len(doc.pages),'text':''.join(p.extract_text() or '' for p in doc.pages),'warnings':[str(w.message) for w in caught]}))",
].join("\n");

async function independentlyRead406(bytes: Uint8Array, phrase: string, pdfKit = false): Promise<void> {
  const pypdf = JSON.parse(execFileSync("python3", ["-c", strictPypdf], {
    input: Buffer.from(bytes), timeout: 8000, maxBuffer: 100000, encoding: "utf8",
  })) as { pages: number; text: string; warnings: string[] };
  expect(pypdf).toMatchObject({ pages: 1, warnings: [] });
  expect(pypdf.text).toContain(phrase);
  const loader = getDocument({ data: Uint8Array.from(bytes), disableFontFace: true, useSystemFonts: true });
  try {
    const pdf = await loader.promise;
    expect(pdf.numPages).toBe(1);
    const page = await pdf.getPage(1);
    expect((await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(""))
      .toContain(phrase);
  } finally { await loader.destroy(); }
  if (pdfKit && process.platform === "darwin") {
    const swift = [
      "import Foundation",
      "import PDFKit",
      "guard let pdf = PDFDocument(data: FileHandle.standardInput.readDataToEndOfFile()) else { exit(2) }",
      `print(pdf.pageCount, (pdf.string ?? "").contains("${phrase}"))`,
    ].join("; ");
    expect(execFileSync("swift", ["-e", swift], {
      input: Buffer.from(bytes), timeout: 60000, encoding: "utf8", maxBuffer: 10000,
    }).trim()).toBe("1 true");
  }
}

describe("#406 single-revision incidental footer markers are not PDF revisions", () => {
  for (const [label, phrase, pdfKit] of [
    ["startxref inside a real PDF literal Tj string", "Sample text startxref is ordinary", true],
    ["%%EOF inside a real PDF literal Tj string", "Sample text %%EOF is ordinary", false],
  ] as const) {
    it(`accepts ${label}, with unchanged xref offsets and strict independent readers`, async () => {
      const bytes = visibleText406(phrase);
      await independentlyRead406(bytes, phrase, pdfKit);
      expect(parsePdf(bytes).pages).toHaveLength(1);
      expect(assertSupportedSource237(bytes)).toBe(1);
    }, 25000);
  }

  it("accepts a harmless PDF comment containing ordinary standalone startxref text", async () => {
    const bytes = Buffer.from(canonical.replace("startxref\n860\n%%EOF\n",
      "% benign annotation startxref is not a footer\nstartxref\n860\n%%EOF\n"), "latin1");
    expect(bytes.indexOf(Buffer.from("xref\n0 9\n"))).toBe(860);
    await independentlyRead406(bytes, PRIVATE_MARKER_237);
    expect(assertSupportedSource237(bytes)).toBe(1);
  }, 25000);

  for (const [label, separator] of [["form feed", "\f"], ["NUL", "\x00"]] as const) {
    it(`accepts legal ${label} whitespace immediately before the actual xref trailer`, async () => {
      const altered = canonical.replace("trailer\n<<", `${separator}trailer\n<<`);
      expect(altered).not.toBe(canonical);
      const bytes = Buffer.from(altered, "latin1");
      expect(bytes.indexOf(Buffer.from("xref\n0 9\n"))).toBe(860);
      await independentlyRead406(bytes, PRIVATE_MARKER_237);
      expect(parsePdf(bytes).pages).toHaveLength(1);
      expect(assertSupportedSource237(bytes)).toBe(1);
    }, 25000);
  }

  it("refuses 500,000 extra startxref tokens in malformed xref footer within a 48 MiB V8 heap", () => {
    const script = [
      "import { coveredRecoverableSource237 } from './tests/fixtures/pdf-redaction-malicious-237.ts';",
      "import { assertSupportedSource237 } from './src/engines/pdf/secure-raster-redaction-237.ts';",
      "const src=Buffer.from(coveredRecoverableSource237()).toString('latin1');",
      "const flood=src.replace('trailer\\n<<', 'startxref\\n'.repeat(500000)+'trailer\\n<<');",
      "if(flood===src || Buffer.byteLength(flood)>8*1024*1024) process.exit(2);",
      "try { assertSupportedSource237(Buffer.from(flood,'latin1')); process.exit(3); }",
      "catch(e) { if(!(e instanceof Error) || !e.message.includes('REDACTION_REFUSED:')) throw e; }",
      "console.log('BOUNDED_MARKER_REFUSAL_406');",
    ].join("\n");
    const output = execFileSync(process.execPath, [
      "--max-old-space-size=48", "--import", "tsx", "--input-type=module", "-e", script,
    ], {
      cwd: resolve(import.meta.dirname, ".."), encoding: "utf8", timeout: 12000,
      maxBuffer: 50000, stdio: ["ignore", "pipe", "pipe"],
    });
    expect(output.trim()).toBe("BOUNDED_MARKER_REFUSAL_406");
  }, 16000);
});
