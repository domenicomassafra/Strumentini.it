import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { analyzeFileSize } from "../src/engines/file-privacy";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";

function fixture(content: string, image = false) {
  const writer = new PdfBuilder();
  const root = writer.reserve(); const pages = writer.reserve(); const page = writer.reserve();
  const raw = new TextEncoder().encode(content);
  const contents = writer.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: raw });
  let imageId: number | null = null;
  const resources = image ? (() => {
    const payload = new Uint8Array(deflateSync(new Uint8Array(480 * 360 * 3)));
    const ref = writer.putAuto({ kind: "stream", dictionary: pdfDict({
      Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(480),
      Height: pdfNumber(360), Filter: pdfName("FlateDecode"),
      ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8),
    }), bytes: payload });
    imageId = ref.id;
    return pdfDict({ XObject: pdfDict({ Im0: ref }) });
  })() : pdfDict({});
  writer.put(page, pdfDict({ Type: pdfName("Page"), Parent: pages, Contents: contents,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(480), pdfNumber(360)]), Resources: resources }));
  writer.put(pages, pdfDict({ Type: pdfName("Pages"), Count: pdfNumber(1), Kids: pdfArray([page]) }));
  writer.put(root, pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return { bytes: writer.build(root, null), contentId: contents.id, imageId, contentLength: raw.length };
}

describe("#265 local PDF source-backed size adapter", () => {
  it("measures exact encoded stream payload contributions for a known full-page image PDF", async () => {
    const input = fixture("q 480 0 0 360 0 0 cm /Im0 Do Q\n", true);
    const file = new File([Uint8Array.from(input.bytes)], "scan.pdf", { type: "application/pdf" });
    const before = Uint8Array.from(input.bytes);
    const answer = await analyzeFileSize({ files: [file] });
    expect(answer).toMatchObject({ kind: "pdf", estimatedSavingsBytes: null, sourceMutation: "none",
      pdf: { pageCount: 1, classification: "image-only-page-candidate", imagePlacementCoverage: "verified-simple-uncompressed-paints" } });
    const pdf = answer.pdf as { encodedStreamBytes: number; structuralRemainderBytes: number;
      largestStreams: Array<{ objectId: number; encodedBytes: number; kind: string }> };
    expect(pdf.encodedStreamBytes + pdf.structuralRemainderBytes).toBe(before.length);
    expect(pdf.largestStreams).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: input.imageId, kind: "image" }),
      expect.objectContaining({ objectId: input.contentId, encodedBytes: input.contentLength }),
    ]));
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(before);
  });

  it("returns unknown classification for mixed text/painting rather than inventing scan coverage", async () => {
    const input = fixture("q 480 0 0 360 0 0 cm /Im0 Do Q\nBT (Hello) Tj ET\n", true);
    const result = await analyzeFileSize({ files: [new File([Uint8Array.from(input.bytes)], "mix.pdf")] });
    expect(result).toMatchObject({ kind: "pdf", pdf: { classification: "unknown", imagePlacementCoverage: "unknown" } });
  });

  it("produces no fabricated savings, DPI or class for content without validated image placement", async () => {
    const input = fixture("BT /F1 12 Tf (Vector text) Tj ET\n");
    const result = await analyzeFileSize({ files: [new File([Uint8Array.from(input.bytes)], "vector.pdf")] });
    expect(result).toMatchObject({ kind: "pdf", recommendedOptimizer: "pdf-compression-lite", estimatedSavingsBytes: null,
      pdf: { classification: "unknown", imagePlacementCoverage: "unknown" } });
  });

  it("rejects a malformed PDF and respects cancellation without publishing a size classification", async () => {
    const fake = new File([new TextEncoder().encode("%PDF-1.7\n%%EOF\n")], "fake.pdf", { type: "application/pdf" });
    await expect(analyzeFileSize({ files: [fake] })).rejects.toThrow();
    const source = fixture("q 480 0 0 360 0 0 cm /Im0 Do Q\n", true);
    const controller = new AbortController(); controller.abort();
    await expect(analyzeFileSize({ files: [new File([Uint8Array.from(source.bytes)], "scan.pdf")] }, controller.signal))
      .rejects.toThrow(/CANCELLED/u);
  });
});
