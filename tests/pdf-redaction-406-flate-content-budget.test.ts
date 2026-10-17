import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { assertSupportedSource237, redactPdfRaster237 } from "../src/engines/pdf/secure-raster-redaction-237";

type FilterMode406 = "name" | "array" | "reference" | "alias";

function flateContentPdf406(decodedStreams: readonly number[], filterMode: FilterMode406 = "name", imageLabel = false): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const indirectFilter = filterMode === "reference" ? builder.putAuto(pdfName("FlateDecode")) : null;
  const streams = decodedStreams.map((decodedBytes) => {
    const content = Buffer.alloc(decodedBytes, 0x20);
    content.write("q Q\n", Math.max(0, content.length - 4), "ascii");
    return builder.putAuto({
      kind: "stream",
      dictionary: pdfDict({
        Filter: filterMode === "array" ? pdfArray([pdfName("FlateDecode")])
          : indirectFilter ?? pdfName(filterMode === "alias" ? "Fl" : "FlateDecode"),
        ...(imageLabel ? { Type: pdfName("XObject"), Subtype: pdfName("Image"),
          Width: pdfNumber(1), Height: pdfNumber(1), BitsPerComponent: pdfNumber(8),
          ColorSpace: pdfName("DeviceRGB") } : {}),
      }),
      bytes: new Uint8Array(deflateSync(content)),
    });
  });
  const page = builder.putAuto(pdfDict({
    Type: pdfName("Page"),
    Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(100), pdfNumber(100)]),
    Resources: pdfDict({}),
    Contents: streams.length === 1 ? streams[0]! : pdfArray(streams),
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const root = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return builder.build(root, null);
}

function independentDecodedLength406(source: Uint8Array): number {
  const python = [
    "from io import BytesIO",
    "from pypdf import PdfReader",
    "import sys",
    "pdf=PdfReader(BytesIO(sys.stdin.buffer.read()), strict=True)",
    "assert len(pdf.pages)==1",
    "print(len(pdf.pages[0].get_contents().get_data()))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", python], {
    input: Buffer.from(source), encoding: "utf8", timeout: 15_000, maxBuffer: 30_000,
  });
  expect(result.status, result.stderr).toBe(0);
  return Number(result.stdout.trim());
}

describe("#406 bounded direct-Flate content admission", () => {
  it("refuses the same decoded bomb through the Fl abbreviation accepted by independent readers", () => {
    const source = flateContentPdf406([12 * 1024 * 1024], "alias");
    expect(independentDecodedLength406(source)).toBe(12 * 1024 * 1024);
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
  }, 20_000);

  it("does not exempt a page content stream merely because its dictionary claims Image", () => {
    const source = flateContentPdf406([12 * 1024 * 1024], "name", true);
    expect(independentDecodedLength406(source)).toBe(12 * 1024 * 1024);
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
  }, 20_000);

  it("keeps a bounded direct-Flate content stream inside the supported source profile", () => {
    const source = flateContentPdf406([256 * 1024]);
    expect(independentDecodedLength406(source)).toBe(256 * 1024);
    expect(assertSupportedSource237(source)).toBe(1);
  });

  it("refuses a tiny readable PDF whose non-image content stream expands past the redaction budget", () => {
    const source = flateContentPdf406([12 * 1024 * 1024]);
    expect(source.byteLength).toBeLessThan(32_000);
    expect(independentDecodedLength406(source)).toBe(12 * 1024 * 1024);
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
  }, 20_000);

  it("refuses aggregate bounded Flate content through the real redaction entrypoint before rendering", async () => {
    const source = flateContentPdf406([7 * 1024 * 1024, 7 * 1024 * 1024]);
    expect(source.byteLength).toBeLessThan(32_000);
    expect(independentDecodedLength406(source)).toBe(14 * 1024 * 1024);
    await expect(redactPdfRaster237(
      new File([Uint8Array.from(source)], "aggregate-flate-budget.pdf", { type: "application/pdf" }),
      [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
    )).rejects.toThrow(/REDACTION_REFUSED/u);
  }, 20_000);

  it("refuses the same over-budget stream when FlateDecode is expressed as a one-item filter array", () => {
    const source = flateContentPdf406([12 * 1024 * 1024], "array");
    expect(source.byteLength).toBeLessThan(32_000);
    expect(independentDecodedLength406(source)).toBe(12 * 1024 * 1024);
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
  }, 20_000);

  it("refuses the same over-budget stream when its FlateDecode filter is an indirect PDF reference", () => {
    const source = flateContentPdf406([12 * 1024 * 1024], "reference");
    expect(source.byteLength).toBeLessThan(32_000);
    expect(independentDecodedLength406(source)).toBe(12 * 1024 * 1024);
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED/u);
  }, 20_000);
});
