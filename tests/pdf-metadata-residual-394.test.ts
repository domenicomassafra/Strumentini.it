/** #153 / STR-394: forensic reparse of real JPEG carriers inside PDF exports. */
import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import {
  buildPdfFromJpegs,
  inspectPdfBytes,
  parseJpeg,
  removePdfMetadataVerified,
} from "../src/engines/pdf";
import { parsePdf } from "../src/engines/pdf/parser";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { auditPdfEmbeddedImageMetadata } from "../src/engines/pdf/metadata-residual-394";
import { pdfMetadataBeforeAfterRows } from "../src/components/tools/pdf/pdf-metadata-summary-394";

const PRIVATE = "STR394_PERSONAL_GPS_EXIF_NESTED_PREVIEW";
const pixels = Buffer.from([
  200, 45, 5, 7, 12, 220, 70, 100, 35,
  90, 130, 240, 190, 50, 50, 45, 210, 15,
]);

async function photo(withExif: boolean): Promise<Uint8Array> {
  const image = sharp(pixels, { raw: { width: 3, height: 2, channels: 3 } });
  const jpeg = withExif
    ? await image.withExif({ IFD0: { Copyright: PRIVATE } }).jpeg().toBuffer()
    : await image.jpeg().toBuffer();
  expect((await sharp(jpeg).metadata()).format).toBe("jpeg");
  expect(jpeg.includes(Buffer.from(PRIVATE))).toBe(withExif);
  return new Uint8Array(jpeg);
}

async function documentWithPhoto(withExif: boolean): Promise<Uint8Array> {
  const jpeg = await photo(withExif);
  const parsed = parseJpeg(jpeg);
  expect(parsed).not.toBeNull();
  return buildPdfFromJpegs([parsed!]);
}

/** Build a valid PDF structure with a deliberately damaged embedded JPEG.
 * This checks the PDF export gate, not JPEG decoding in a browser. */
function pdfWithUntrustedJpeg(jpeg: Uint8Array, indirect = false): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const subtype = indirect ? builder.putAuto(pdfName("Image")) : pdfName("Image");
  const filter = indirect ? builder.putAuto(pdfName("DCTDecode")) : pdfName("DCTDecode");
  const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: subtype, Width: pdfNumber(3), Height: pdfNumber(2),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: filter,
  }), bytes: jpeg });
  const content = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode("q 3 0 0 2 0 0 cm /Im0 Do Q") });
  const page = builder.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages, MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(3), pdfNumber(2)]),
    Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }), Contents: content,
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Count: pdfNumber(1), Kids: pdfArray([page]) }));
  return builder.build(builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages })), null);
}

function documentWithFlateRaster(): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(2), Height: pdfNumber(2),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
  }), bytes: new Uint8Array(deflateSync(Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 200, 10, 30]))) });
  const content = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode("q 2 0 0 2 0 0 cm /Im0 Do Q") });
  const page = builder.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages, MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(2), pdfNumber(2)]),
    Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }), Contents: content,
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Count: pdfNumber(1), Kids: pdfArray([page]) }));
  const catalog = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return builder.build(catalog, null);
}

describe("#394 PDF nested metadata post-export", () => {
  it("refuses decodable nested JPEG with over-limit APP1 count instead of dropping partial Exif findings", async () => {
    const clean = Buffer.from(await photo(false));
    const payload = Buffer.from(`Exif\0\0${PRIVATE}`, "utf8");
    const marker = Buffer.concat([Buffer.from([0xff, 0xe1, (payload.length + 2) >>> 8, (payload.length + 2) & 255]), payload]);
    const attacked = Buffer.concat([clean.subarray(0, 2), ...Array.from({ length: 513 }, () => marker), clean.subarray(2)]);
    expect((await sharp(attacked).metadata()).format).toBe("jpeg");
    const source = pdfWithUntrustedJpeg(new Uint8Array(attacked));
    const audit = auditPdfEmbeddedImageMetadata(parsePdf(source));
    expect(audit.incompleteJpegObjectIds).toHaveLength(1);
    expect(audit.privacyFindings).toHaveLength(1);
    await expect(removePdfMetadataVerified(source, "many-exif-markers"))
      .rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
  });
  it("does not advertise zero residuals when no embedded JPEG was verified", () => {
    const result = pdfMetadataBeforeAfterRows({
      verification: { embeddedImageAudit: { jpegChecked: 0, unsupported: [] } },
    });
    expect(result.find((row) => row.label.startsWith("Residui non verificati"))?.value)
      .toContain("Nessun JPEG verificato; contenuti non certificati");
    const many = pdfMetadataBeforeAfterRows({
      verification: { embeddedImageAudit: { jpegChecked: 2, unsupported: Array.from({ length: 100 }, (_, i) => `carrier-${i}`) } },
    });
    const warning = many.find((row) => row.label.startsWith("Residui non verificati"));
    expect(warning?.label).toContain("100");
    expect(warning?.value).toContain("altri 92 residui");
    expect(warning?.value).not.toContain("carrier-99");
  });
  it("resolves indirect image subtype and DCT filter before assessing real nested EXIF", async () => {
    const source = pdfWithUntrustedJpeg(await photo(true), true);
    const before = auditPdfEmbeddedImageMetadata(parsePdf(source));
    expect(before.privacyFindings).toHaveLength(1);
    expect(before.privacyFindings[0]?.segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ carrier: "exif" }),
    ]));
    await expect(removePdfMetadataVerified(source, "indirect-exif"))
      .rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
  });
  it("fails closed on a truncated embedded JPEG even when the PDF itself reparses", async () => {
    const valid = await photo(true);
    const truncated = valid.slice(0, valid.length - 2); // EOI lost; Exif marker survives
    const source = pdfWithUntrustedJpeg(truncated);
    const audit = auditPdfEmbeddedImageMetadata(parsePdf(source));
    expect(audit.incompleteJpegObjectIds).toHaveLength(1);
    expect(audit.privacyFindings).toEqual([expect.objectContaining({
      segments: expect.arrayContaining([expect.objectContaining({ carrier: "exif" })]),
    })]);
    await expect(removePdfMetadataVerified(source, "damaged-jpeg"))
      .rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
  });
  it("rejects deliverable when a real EXIF JPEG survives the PDF writer", async () => {
    const source = await documentWithPhoto(true);
    const before = auditPdfEmbeddedImageMetadata(parsePdf(source));
    expect(before.privacyFindings).toHaveLength(1);
    expect(before.privacyFindings[0]?.segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ carrier: "exif", segment: "JPEG APP1" }),
    ]));
    expect(inspectPdfBytes(source).pageCount).toBe(1);
    await expect(removePdfMetadataVerified(source, "nested-exif"))
      .rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
  });

  it("reopens exported PDF and reports exact supported JPEG subset and residual limitations", async () => {
    const source = await documentWithPhoto(false);
    const original = auditPdfEmbeddedImageMetadata(parsePdf(source));
    expect(original).toMatchObject({ jpegChecked: 1, privacyFindings: [], unsupported: [] });
    const { artifact, verification, before, after } = await removePdfMetadataVerified(source, "clean-image");
    expect(verification).toMatchObject({
      reparsed: true, metadataRemoved: true, pageCount: { stable: true },
      embeddedImageAudit: { jpegChecked: 1, privacyFindings: [], unsupported: [] },
    });
    const exported = new Uint8Array(await artifact.blob.arrayBuffer());
    expect(exported).toEqual(artifact.bytes);
    expect(auditPdfEmbeddedImageMetadata(parsePdf(exported))).toEqual(verification.embeddedImageAudit);
    expect(before.pageCount).toBe(1);
    expect(after.pageCount).toBe(1);
    expect(verification.embeddedImageAudit.limitation).toMatch(/font|annotazioni|steganografici/u);
  });

  it("discloses a real Flate image as unsupported even when /Info and /Metadata are clean", async () => {
    const source = documentWithFlateRaster();
    expect(inspectPdfBytes(source).images).toHaveLength(1);
    const { artifact, verification } = await removePdfMetadataVerified(source, "flate-image");
    expect(verification.embeddedImageAudit).toMatchObject({ jpegChecked: 0, privacyFindings: [] });
    expect(verification.embeddedImageAudit.unsupported).toEqual([expect.stringMatching(/FlateDecode/u)]);
    expect(auditPdfEmbeddedImageMetadata(parsePdf(artifact.bytes))).toEqual(verification.embeddedImageAudit);
  });
});
