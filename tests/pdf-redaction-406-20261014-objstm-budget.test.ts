import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { assertSupportedSource237, redactPdfRaster237, verifySecureRedaction237 } from "../src/engines/pdf/secure-raster-redaction-237";

/** One well-formed single-revision classic-xref PDF, plus a real orphan /ObjStm.
 * The compressed bytes are present in the actual PDF, not inert string tokens.
 */
function sourceWithObjectStream(expandedSize: number): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const contents = builder.putAuto({
    kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode("q Q"),
  });
  const page = builder.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(50), pdfNumber(50)]),
    Resources: pdfDict({}), Contents: contents,
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const root = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  builder.putAuto({
    kind: "stream",
    dictionary: pdfDict({ Type: pdfName("ObjStm"), N: pdfNumber(0), First: pdfNumber(0), Filter: pdfName("FlateDecode") }),
    bytes: new Uint8Array(deflateSync(Buffer.alloc(expandedSize, 65))),
  });
  return builder.build(root, null);
}

const selected = [{ page: 1, left: 0, top: 0, width: 1, height: 1 }] as const;

describe("#406 redaction admission refuses compressed object streams before inflation", () => {
  it("rejects an otherwise parseable orphan ObjStm and creates no output artifact", async () => {
    const source = sourceWithObjectStream(2_000);
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
    await expect(redactPdfRaster237(new File([Uint8Array.from(source)], "orphan-objstm.pdf", { type: "application/pdf" }), selected))
      .rejects.toThrow(/REDACTION_REFUSED/u);
  });

  it("rejects a real 12 MiB compressed object expansion within a 64 MiB V8 heap", () => {
    const source = sourceWithObjectStream(12 * 1024 * 1024);
    // Even a very small input can inflate to a large JS number[] in parsePdf.
    // A separate child limits the heap so the test runner is never put at risk.
    expect(source.byteLength).toBeLessThan(32_000);
    const script = `
import { assertSupportedSource237 } from './src/engines/pdf/secure-raster-redaction-237.ts';
const source = Uint8Array.from(Buffer.from('${Buffer.from(source).toString("base64")}', 'base64'));
try { assertSupportedSource237(source); process.exitCode = 4; }
catch (error) { if (String(error).includes('REDACTION_REFUSED')) process.stdout.write('REFUSED_BEFORE_INFLATE'); else process.exitCode = 5; }
`;
    const result = spawnSync(process.execPath, [
      "--max-old-space-size=64", "--import", "tsx", "--input-type=module", "-e", script,
    ], { cwd: process.cwd(), encoding: "utf8", timeout: 15_000 });
    expect(result.status, `${result.signal ?? ""}: ${(result.stderr ?? "").slice(-400)}`).toBe(0);
    expect(result.stdout).toContain("REFUSED_BEFORE_INFLATE");
  });

  it("also enforces the expansion budget when checking a forged exported artifact", async () => {
    const source = sourceWithObjectStream(2_000);
    await expect(verifySecureRedaction237(source, [{
      page: 1, pageWidth: 50, pageHeight: 50, pixelWidth: 50, pixelHeight: 50,
      regions: [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
    }])).rejects.toThrow(/REDACTION_REFUSED/u);

    const huge = sourceWithObjectStream(12 * 1024 * 1024);
    const script = `
import { verifySecureRedaction237 } from './src/engines/pdf/secure-raster-redaction-237.ts';
const output = Uint8Array.from(Buffer.from('${Buffer.from(huge).toString("base64")}', 'base64'));
const pages = [{ page: 1, pageWidth: 50, pageHeight: 50, pixelWidth: 50, pixelHeight: 50,
  regions: [{ page: 1, left: 0, top: 0, width: 1, height: 1 }] }];
try { await verifySecureRedaction237(output, pages); process.exitCode = 4; }
catch (error) { if (String(error).includes('REDACTION_REFUSED')) process.stdout.write('VERIFIER_REFUSED_BEFORE_INFLATE'); else process.exitCode = 5; }
`;
    const result = spawnSync(process.execPath, [
      "--max-old-space-size=64", "--import", "tsx", "--input-type=module", "-e", script,
    ], { cwd: process.cwd(), encoding: "utf8", timeout: 15_000 });
    expect(result.status, `${result.signal ?? ""}: ${(result.stderr ?? "").slice(-400)}`).toBe(0);
    expect(result.stdout).toContain("VERIFIER_REFUSED_BEFORE_INFLATE");
  });

  it.runIf(spawnSync("python3", ["-c", "import pypdf"], { encoding: "utf8" }).status === 0)(
    "independent strict pypdf reader reopens the valid one-page hostile source", () => {
      const source = sourceWithObjectStream(2_000);
      const result = spawnSync("python3", ["-c", `
import io,sys
from pypdf import PdfReader
reader=PdfReader(io.BytesIO(sys.stdin.buffer.read()),strict=True)
assert len(reader.pages)==1
`], { input: Buffer.from(source) });
      expect(result.status, result.stderr?.toString()).toBe(0);
    },
  );
});
