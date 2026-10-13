import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parsePdf } from "../src/engines/pdf/parser";
import { assertSupportedSource237 } from "../src/engines/pdf/secure-raster-redaction-237";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

const clean = Buffer.from(coveredRecoverableSource237()).toString("latin1");
const python = [
  "from io import BytesIO",
  "from pypdf import PdfReader",
  "import sys,json",
  "reader=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
  "print(json.dumps({'pages':len(reader.pages),'text':''.join(p.extract_text() or '' for p in reader.pages)}))",
].join("\n");

function legalTrailer(whitespace: string): Uint8Array {
  const input = clean.replace("trailer\n<<", `trailer${whitespace}<<`);
  if (input === clean) throw new Error("Expected a real one-revision classic xref table");
  return Buffer.from(input, "latin1");
}

describe("#406 narrow classic xref trailer lexical acceptance and marker budget", () => {
  for (const [label, whitespace] of [
    ["PDF comment", " % benign legal comment\n"],
    ["form feed", "\f"],
  ] as const) {
    it(`accepts classic trailer followed by ${label}, independently reparsed`, async () => {
      const bytes = legalTrailer(whitespace);
      const strict = JSON.parse(execFileSync("python3", ["-c", python], {
        input: bytes, encoding: "utf8", timeout: 8000, maxBuffer: 100000,
      })) as { pages: number; text: string };
      expect(strict.pages).toBe(1);
      expect(strict.text).toContain(PRIVATE_MARKER_237);
      expect(parsePdf(bytes).pages).toHaveLength(1);
      if (process.platform === "darwin") {
        const swift = [
          "import Foundation",
          "import PDFKit",
          "let bytes = FileHandle.standardInput.readDataToEndOfFile()",
          "guard let doc = PDFDocument(data: bytes) else { exit(2) }",
          `print(doc.pageCount, (doc.string ?? "").contains("${PRIVATE_MARKER_237}"))`,
        ].join("; ");
        expect(execFileSync("swift", ["-e", swift], {
          input: Buffer.from(bytes), encoding: "utf8", timeout: 60_000, maxBuffer: 10_000,
        }).trim()).toBe("1 true");
      }
      const loader = getDocument({ data: Uint8Array.from(bytes), disableFontFace: true, useSystemFonts: true });
      try {
        const pdf = await loader.promise;
        expect(pdf.numPages).toBe(1);
        const page = await pdf.getPage(1);
        expect((await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(""))
          .toContain(PRIVATE_MARKER_237);
      } finally {
        await loader.destroy();
      }
      expect(assertSupportedSource237(bytes)).toBe(1);
    }, 20000);
  }

  it("refuses a second real trailer even if followed by an innocuous-looking final dictionary", () => {
    const extra = clean.replace("startxref\n", "trailer\n<< /Size 9 /Root 6 0 R >>\nstartxref\n");
    expect(extra).not.toBe(clean);
    expect(() => assertSupportedSource237(Buffer.from(extra, "latin1")))
      .toThrow(/REDACTION_REFUSED:.*Trailer/u);
  });

  it("refuses a 4 MiB malformed xref footer under a capped 48 MiB JS heap, without collecting its marker matches", () => {
    const script = [
      "import { coveredRecoverableSource237 } from './tests/fixtures/pdf-redaction-malicious-237.ts';",
      "import { assertSupportedSource237 } from './src/engines/pdf/secure-raster-redaction-237.ts';",
      "const source=Buffer.from(coveredRecoverableSource237()).toString('latin1');",
      "const expanded=source.replace('trailer\\n<<', 'trailer\\n'.repeat(500000)+'<<');",
      "if(expanded===source || Buffer.byteLength(expanded)>8*1024*1024) process.exit(2);",
      "try { assertSupportedSource237(Buffer.from(expanded,'latin1')); process.exit(3); }",
      "catch(e) { if(!(e instanceof Error) || !e.message.includes('REDACTION_REFUSED:')) throw e; }",
      "console.log('BOUNDED_REFUSAL_406');",
    ].join("\n");
    const output = execFileSync(process.execPath, [
      "--max-old-space-size=48", "--import", "tsx", "--input-type=module", "-e", script,
    ], {
      cwd: resolve(import.meta.dirname, ".."), encoding: "utf8", timeout: 12000,
      maxBuffer: 50000, stdio: ["ignore", "pipe", "pipe"],
    });
    expect(output.trim()).toBe("BOUNDED_REFUSAL_406");
  }, 16000);
});
