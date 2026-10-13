import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parsePdf } from "../src/engines/pdf/parser";
import { assertSupportedSource237 } from "../src/engines/pdf/secure-raster-redaction-237";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

/** Authentic one-revision source with a classic xref at byte 860. Only the
 * lexical whitespace in the last footer changes, never existing xref offsets. */
const original = Buffer.from(coveredRecoverableSource237()).toString("latin1");
const ordinaryFooter = "startxref\n860\n%%EOF\n";
if (!original.endsWith(ordinaryFooter) || original.length !== 1113 || original.indexOf("xref\n0 9\n") !== 860) {
  throw new Error("Original strict-consumer-proven classic PDF fixture changed");
}
function withFooter(footer: string): Uint8Array {
  return Buffer.from(original.slice(0, -ordinaryFooter.length) + footer, "latin1");
}

const python = [
  "from io import BytesIO",
  "from pypdf import PdfReader",
  "import json,sys,warnings",
  "with warnings.catch_warnings(record=True) as caught:",
  "  warnings.simplefilter('always')",
  "  doc=PdfReader(BytesIO(sys.stdin.buffer.read()),strict=True)",
  "  print(json.dumps({'pages':len(doc.pages),'text':''.join(p.extract_text() or '' for p in doc.pages),",
  "    'warnings':[str(x.message) for x in caught]}))",
].join("\n");

async function strictConsumers(source: Uint8Array): Promise<void> {
  const parsed = JSON.parse(execFileSync("python3", ["-c", python], {
    input: Buffer.from(source), encoding: "utf8", timeout: 8000, maxBuffer: 100_000,
  })) as { pages: number; text: string; warnings: string[] };
  expect(parsed.pages).toBe(1);
  expect(parsed.warnings).toEqual([]);
  expect(parsed.text).toContain(PRIVATE_MARKER_237);

  const loader = getDocument({ data: Uint8Array.from(source), disableFontFace: true, useSystemFonts: true });
  try {
    const doc = await loader.promise;
    expect(doc.numPages).toBe(1);
    const page = await doc.getPage(1);
    expect((await page.getTextContent()).items.map(item => "str" in item ? item.str : "").join(""))
      .toContain(PRIVATE_MARKER_237);
  } finally { await loader.destroy(); }
}

describe("#406 genuine classic PDF footer with multiple legal EOL bytes", () => {
  for (const [label, footer] of [
    ["empty LF line", "startxref\n\n860\n%%EOF\n"],
    ["empty CRLF line", "startxref\r\n\r\n860\r\n%%EOF\r\n"],
    ["FF followed by LF", "startxref\f\n860\n%%EOF\n"],
  ] as const) {
    it(`accepts ${label} independently checked by strict readers`, async () => {
      const valid = withFooter(footer);
      await strictConsumers(valid);
      expect(parsePdf(valid).pages).toHaveLength(1);
      expect(assertSupportedSource237(valid)).toBe(1);
    }, 20_000);
  }

  it("still refuses a complete second revision when the earlier footer has an empty line", () => {
    const first = withFooter("startxref\n\n860\n%%EOF\n");
    const table = /xref\n0 9\n((?:\d{10} \d{5} [fn] \n){9})trailer/u.exec(original)?.[1];
    if (!table) throw new Error("Original xref table entries changed");
    const catalog = "9 0 obj\n<< /Type /Catalog /Pages 1 0 R /Lang (it-IT) >>\nendobj\n";
    const offset = first.length + Buffer.byteLength(catalog, "latin1");
    const extra = "xref\n0 10\n" + table
      + String(first.length).padStart(10, "0") + " 00000 n \n"
      + "trailer\n<< /Size 10 /Root 9 0 R /Prev 860 >>\n"
      + `startxref\n\n${offset}\n%%EOF\n`;
    const incremental = Buffer.concat([Buffer.from(first), Buffer.from(catalog + extra, "latin1")]);
    expect(() => assertSupportedSource237(incremental))
      .toThrow(/REDACTION_REFUSED:.*(?:Revisioni|xref)/u);
  });
});
