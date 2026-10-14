import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inspectPdfBytes, preflightPdfInput } from "../src/engines/pdf";
import { parsePdf, pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";

/** A genuine one-revision, single-page PDF with an unreferenced compressed
 * object stream. Source bytes stay small even when the decoded tail is huge.
 */
function withObjectStream(
  paddingBytes: number | readonly number[],
  tamper?: "checksum" | "truncated" | "trailing",
  declaredCount = 1,
): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const contents = builder.putAuto({
    kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode("q Q"),
  });
  const page = builder.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(72), pdfNumber(72)]),
    Resources: pdfDict({}), Contents: contents,
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const root = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  const amounts = typeof paddingBytes === "number" ? [paddingBytes] : paddingBytes;
  for (let index = 0; index < amounts.length; index += 1) {
    const header = Buffer.from(`${9 + index} 0 `);
    const decoded = Buffer.concat([header, Buffer.from("<< /Safe 1 >>"), Buffer.alloc(amounts[index]!, 32)]);
    let compressed = new Uint8Array(deflateSync(decoded));
    if (tamper === "checksum") {
      compressed = compressed.slice();
      compressed[compressed.length - 1] ^= 0xff;
    } else if (tamper === "truncated") {
      compressed = compressed.subarray(0, compressed.length - 2);
    } else if (tamper === "trailing") {
      compressed = Uint8Array.from([...compressed, 65, 66, 67]);
    }
    builder.putAuto({
      kind: "stream",
      dictionary: pdfDict({
        Type: pdfName("ObjStm"), N: pdfNumber(declaredCount), First: pdfNumber(header.length), Filter: pdfName("FlateDecode"),
      }),
      bytes: compressed,
    });
  }
  return builder.build(root, null);
}

describe("#407 shared PDF parser compressed object-stream resource safety", () => {
  it("keeps valid compact ObjStm object decoding available to normal PDF consumers", () => {
    const source = withObjectStream(30);
    const model = parsePdf(source);
    const nested = model.objects.get(9)?.value;
    expect(nested?.kind).toBe("dict");
    if (nested?.kind === "dict") expect(nested.entries.get("Safe")).toMatchObject({ kind: "literal", value: "1" });
    expect(inspectPdfBytes(source)).toMatchObject({ pageCount: 1 });
  });

  it("refuses 12 MiB inflation from a sub-32 KiB valid PDF without exhausting a 64 MiB V8 heap", () => {
    const source = withObjectStream(12 * 1024 * 1024);
    expect(source.byteLength).toBeLessThan(32_000);
    const script = `
import { parsePdf } from './src/engines/pdf/parser.ts';
import { inspectPdfBytes } from './src/engines/pdf/index.ts';
const source=Uint8Array.from(Buffer.from('${Buffer.from(source).toString("base64")}', 'base64'));
try { parsePdf(source); process.exitCode=3; }
catch (error) {
  if (!String(error).includes('PDF_LIMIT')) { process.exitCode=4; }
  else {
    try { inspectPdfBytes(source); process.exitCode=5; }
    catch (consumerError) { if (consumerError?.code !== 'PDF_LIMIT') process.exitCode=6; else process.stdout.write('BOUNDED_REFUSAL'); }
  }
}
`;
    const result = spawnSync(process.execPath, [
      "--max-old-space-size=64", "--import", "tsx", "--input-type=module", "-e", script,
    ], { cwd: process.cwd(), encoding: "utf8", timeout: 15_000 });
    expect(result.status, `${result.signal ?? ""}: ${(result.stderr ?? "").slice(-400)}`).toBe(0);
    expect(result.stdout).toContain("BOUNDED_REFUSAL");
  });

  it.each(["checksum", "truncated", "trailing"] as const)("refuses malformed %s Flate framing", (tamper) => {
    expect(() => parsePdf(withObjectStream(120, tamper))).toThrow(/MALFORMED_PDF/u);
  });

  it("checks declared object-stream entry count before expanding even a tiny compressed bomb", () => {
    const source = withObjectStream(12 * 1024 * 1024, undefined, 50_000);
    expect(() => parsePdf(source)).toThrow(/PDF_LIMIT: object stream header/u);
  });

  it("caps the combined decode budget across several otherwise valid object streams", () => {
    const source = withObjectStream([3 * 1024 * 1024, 3 * 1024 * 1024, 3 * 1024 * 1024]);
    expect(() => parsePdf(source)).toThrow(/PDF_LIMIT/u);
  });

  it("retains cancellation before an untrusted object stream reaches the consumer", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(preflightPdfInput(withObjectStream(12 * 1024 * 1024), undefined, controller.signal))
      .rejects.toMatchObject({ code: "CANCELLED" });
  });

  it.runIf(spawnSync("python3", ["-c", "import pypdf"], { encoding: "utf8" }).status === 0)(
    "independent strict pypdf opens genuine compressed object-stream input", () => {
      const source = withObjectStream(120);
      const child = spawnSync("python3", ["-c", `
import io,sys
from pypdf import PdfReader
r=PdfReader(io.BytesIO(sys.stdin.buffer.read()),strict=True)
assert len(r.pages)==1
`], { input: Buffer.from(source) });
      expect(child.status, child.stderr?.toString()).toBe(0);
    },
  );
});
