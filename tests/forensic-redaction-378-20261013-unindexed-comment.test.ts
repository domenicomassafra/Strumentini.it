import { deflateSync } from "node:zlib";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";
import { forensicRedactionGate378, type ForensicPlan378 } from "../scripts/forensic-redaction-378";

const realPdfKit = process.platform === "darwin" && existsSync("/usr/bin/swift");
const source = coveredRecoverableSource237();
const plan: ForensicPlan378 = {
  sourceWitnesses: [PRIVATE_MARKER_237],
  pages: [{
    page: 1, pageWidth: 20, pageHeight: 20, pixelWidth: 20, pixelHeight: 20,
    regions: [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }],
  }],
};

function actualRasterPdf(trailingCompressedSecret = false): Uint8Array {
  const rgb = new Uint8Array(20 * 20 * 3);
  for (let n = 200; n < 400; n += 1) rgb[n * 3] = 100;
  const raster = deflateSync(rgb);
  const encoded = trailingCompressedSecret
    ? Buffer.concat([raster, Buffer.from("SECRET_PLAINTEXT_AFTER_FLATE_END_378_552211", "ascii")])
    : raster;
  const writer = new PdfBuilder();
  const pages = writer.reserve();
  const image = writer.putAuto({
    kind: "stream",
    dictionary: pdfDict({
      Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(20), Height: pdfNumber(20),
      ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
    }),
    bytes: new Uint8Array(encoded),
  });
  const contents = writer.putAuto({ kind: "stream", dictionary: pdfDict({}),
    bytes: new TextEncoder().encode("q\n20 0 0 20 0 0 cm\n/Im0 Do\nQ\n") });
  const page = writer.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(20), pdfNumber(20)]),
    Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }), Contents: contents,
  }));
  writer.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const root = writer.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return writer.build(root, null);
}

function injectRecoverableUnindexedComment(output: Uint8Array): Uint8Array {
  const bytes = Buffer.from(output);
  const xref = bytes.lastIndexOf(Buffer.from("xref\n0 "));
  expect(xref).toBeGreaterThan(0);
  const previousTail = bytes.subarray(xref).toString("latin1");
  expect(previousTail).toMatch(new RegExp(`startxref\\n${xref}\\n%%EOF\\n$`, "u"));
  const comment = Buffer.from("% FORENSIC_UNINDEXED_PRIVATE_SSN_378_123456789\n", "ascii");
  const movedTail = Buffer.from(previousTail.replace(`startxref\n${xref}\n`, `startxref\n${xref + comment.length}\n`), "latin1");
  // All object offsets remain correct; only the genuine xref position changes.
  return Buffer.concat([bytes.subarray(0, xref), comment, movedTail]);
}

function injectIgnoredCommentInsideCatalog(output: Uint8Array): Uint8Array {
  const bytes = Buffer.from(output);
  const xref = bytes.lastIndexOf(Buffer.from("xref\n0 "));
  const catalogEnd = bytes.lastIndexOf(Buffer.from("endobj\n"), xref);
  expect(catalogEnd).toBeGreaterThan(0);
  const comment = Buffer.from("% PRIVATE_UNINDEXED_CATALOG_NOTE_378_987654321\n", "ascii");
  const previousTail = bytes.subarray(xref).toString("latin1");
  const movedTail = Buffer.from(previousTail.replace(`startxref\n${xref}\n`, `startxref\n${xref + comment.length}\n`), "latin1");
  return Buffer.concat([
    bytes.subarray(0, catalogEnd), comment, bytes.subarray(catalogEnd, xref), movedTail,
  ]);
}

describe("#378 unindexed recoverable bytes in otherwise valid PDF", () => {
  it("refuses real unindexed comment data invisible to both independent page viewers", () => {
    const baseline = actualRasterPdf();
    // Linux still executes every hostile refusal; only the positive native
    // PDFKit attestation is restricted to a Mac with real PDFKit available.
    if (realPdfKit) {
      expect(forensicRedactionGate378(source, baseline, plan).status)
        .toBe("INDEPENDENT_SAMPLE_PASS_NOT_RELEASE");
    }
    const hostile = injectRecoverableUnindexedComment(baseline);
    expect(Buffer.from(hostile).includes(Buffer.from("FORENSIC_UNINDEXED_PRIVATE_SSN_378_123456789"))).toBe(true);
    // RED before a structural gap guard: pypdf strict + PDFKit both accept.
    expect(() => forensicRedactionGate378(source, hostile, plan))
      .toThrow(/FORENSIC_378_REFUSED/u);
  }, 35_000);

  it("refuses private comment bytes ignored inside indexed catalog object", () => {
    const hostile = injectIgnoredCommentInsideCatalog(actualRasterPdf());
    expect(Buffer.from(hostile).includes(Buffer.from("PRIVATE_UNINDEXED_CATALOG_NOTE_378_987654321"))).toBe(true);
    expect(() => forensicRedactionGate378(source, hostile, plan))
      .toThrow(/FORENSIC_378_REFUSED/u);
  }, 35_000);

  it("refuses recoverable private trailing bytes ignored by FlateDecode", () => {
    const hostile = actualRasterPdf(true);
    expect(Buffer.from(hostile).includes(Buffer.from("SECRET_PLAINTEXT_AFTER_FLATE_END_378_552211"))).toBe(true);
    expect(() => forensicRedactionGate378(source, hostile, plan))
      .toThrow(/FORENSIC_378_REFUSED/u);
  }, 35_000);
});
