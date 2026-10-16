import { spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { verifySecureRedaction237 } from "../src/engines/pdf/secure-raster-redaction-237";

const spec = {
  page: 1, pageWidth: 10, pageHeight: 10, pixelWidth: 10, pixelHeight: 10,
  regions: [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }],
} as const;
const secret = "PRIVATE_AFTER_ZLIB_EOS_406_20261014";

async function makeExport(compressedTail = new Uint8Array(0)): Promise<{ pdf: Uint8Array; encoded: Uint8Array; raw: Uint8Array }> {
  const raw = new Uint8Array(300);
  raw.fill(128, 150); // black selected top half; readable bottom half
  const compressed = new Uint8Array(await new Response(
    new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")),
  ).arrayBuffer());
  const encoded = Uint8Array.from([...compressed, ...compressedTail]);
  const writer = new PdfBuilder();
  const pages = writer.reserve();
  const image = writer.putAuto({
    kind: "stream",
    dictionary: pdfDict({
      Type: pdfName("XObject"), Subtype: pdfName("Image"),
      Width: pdfNumber(10), Height: pdfNumber(10),
      ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
    }),
    bytes: encoded,
  });
  const content = writer.putAuto({
    kind: "stream", dictionary: pdfDict({}),
    bytes: new TextEncoder().encode("q\n10 0 0 10 0 0 cm\n/Im0 Do\nQ\n"),
  });
  const page = writer.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(10), pdfNumber(10)]),
    Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }), Contents: content,
  }));
  writer.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const root = writer.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return { pdf: writer.build(root, null), encoded, raw };
}

describe("#406 verifier must not certify recoverable image Flate tails", () => {
  it("accepts the exact fresh producer image and rejects recoverable plaintext beyond zlib EOS", async () => {
    const safe = await makeExport();
    await expect(verifySecureRedaction237(safe.pdf, [spec])).resolves.toMatchObject({
      pageCount: 1, verifiedBlackPixels: 50,
    });

    const hostile = await makeExport(new TextEncoder().encode(secret));
    expect(new TextDecoder("latin1").decode(hostile.pdf)).toContain(secret);
    // Node zlib and PDF readers tolerate encoded bytes beyond the first zlib EOS.
    expect(inflateSync(hostile.encoded)).toEqual(Buffer.from(hostile.raw));
    await expect(verifySecureRedaction237(hostile.pdf, [spec]))
      .rejects.toThrow(/REDACTION_REFUSED/u);
  });

  it("rejects a second valid zlib member appended after the intended image", async () => {
    const second = new Uint8Array(await new Response(
      new Blob([new TextEncoder().encode(secret)]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer());
    const hostile = await makeExport(second);
    expect(inflateSync(hostile.encoded)).toEqual(Buffer.from(hostile.raw));
    await expect(verifySecureRedaction237(hostile.pdf, [spec]))
      .rejects.toThrow(/REDACTION_REFUSED/u);
  });

  it.runIf(spawnSync("python3", ["-c", "import pypdf"], { encoding: "utf8" }).status === 0)(
    "independent strict pypdf reader reopens the PDF with a recoverable Flate tail", async () => {
      const hostile = await makeExport(new TextEncoder().encode(secret));
      const result = spawnSync("python3", ["-c", `
import io,sys
from pypdf import PdfReader
payload=sys.stdin.buffer.read()
reader=PdfReader(io.BytesIO(payload),strict=True)
assert len(reader.pages)==1
image=reader.pages[0]["/Resources"]["/XObject"]["/Im0"].get_object()
assert image.get_data()==bytes([0]*150+[128]*150)
assert b"${secret}" in image._data
`], { input: Buffer.from(hostile.pdf) });
      expect(result.status, result.stderr?.toString()).toBe(0);
    },
  );
});
