/** Independent #237 adversarial PDF constructors. Sources are never public assets.
 * Real classic xref tables and incremental revisions are produced, instead of
 * merely inserting an inert /Prev keyword in a byte string.
 */
import { PdfBuilder } from "../../src/engines/pdf/writer";
import {
  pdfArray, pdfDict, pdfName, pdfNumber, pdfReference, pdfString,
} from "../../src/engines/pdf/parser";

const encode = (value: string) => new TextEncoder().encode(value);
export const PRIVATE_MARKER_237 = "PRIVATE_237_SOURCE_ONLY_NEVER_OUTPUT_4D792A";
export const ORPHAN_MARKER_237 = "ORPHAN_237_RECOVERABLE_PRIVATE_7F9D13";
export const IMAGE_MARKER_237 = Uint8Array.from([189, 17, 49, 13, 211, 28, 37, 77, 151, 198, 67, 233]);

function content(builder: PdfBuilder, data: string) {
  return builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: encode(data) });
}

/** Source with searchable sensitive text under a black *visual* cover and orphan object. */
export function coveredRecoverableSource237(): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const raster = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(2), Height: pdfNumber(2),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8),
  }), bytes: IMAGE_MARKER_237 });
  const text = content(builder, `q\nBT /F0 6 Tf 4 115 Td (${PRIVATE_MARKER_237}) Tj ET\nQ\n`
    + "q 0 0 0 rg 0 90 180 50 re f Q\n" // opaque overlay is NOT redaction
    + "q 0 0 1 rg 0 0 180 50 re f Q\n"
    + "q 24 0 0 24 25 6 cm /ImPrivate Do Q\n");
  const page = builder.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages, MediaBox: pdfArray([0, 0, 180, 140].map(pdfNumber)),
    Contents: text, Resources: pdfDict({ Font: pdfDict({ F0: font }), XObject: pdfDict({ ImPrivate: raster }) }),
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const root = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  builder.putAuto(pdfDict({ OrphanMarker: pdfString(ORPHAN_MARKER_237) }));
  const info = builder.putAuto(pdfDict({ Subject: pdfString(PRIVATE_MARKER_237) }));
  return builder.build(root, info);
}

/** Content model that forces PDF.js to composite Image XObject + SMask + Form + ExtGState. */
export function complexRasterSource237(rotated: 0 | 90 | 180 | 270 = 0): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const alphaMask = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(2), Height: pdfNumber(2),
    ColorSpace: pdfName("DeviceGray"), BitsPerComponent: pdfNumber(8),
  }), bytes: Uint8Array.from([255, 0, 255, 0]) });
  const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(2), Height: pdfNumber(2),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), SMask: alphaMask,
  }), bytes: IMAGE_MARKER_237 });
  const form = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Form"), FormType: pdfNumber(1),
    BBox: pdfArray([0, 0, 180, 140].map(pdfNumber)),
    Resources: pdfDict({ XObject: pdfDict({ Im0: image }),
      ExtGState: pdfDict({ S: pdfDict({ ca: pdfNumber(0.6), CA: pdfNumber(0.6) }) }) }),
  }), bytes: encode("q /S gs 80 0 0 80 25 20 cm /Im0 Do Q\n") });
  const stream = content(builder, "q 0.2 0.5 0.85 rg 0 0 180 140 re f Q\nq /Fm0 Do Q\n");
  const page = builder.putAuto(pdfDict({ Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([0, 0, 180, 140].map(pdfNumber)), Rotate: pdfNumber(rotated),
    Resources: pdfDict({ XObject: pdfDict({ Fm0: form }) }), Contents: stream }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const root = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  builder.putAuto(pdfDict({ OrphanMarker: pdfString(ORPHAN_MARKER_237) }));
  return builder.build(root, null);
}

/** Signed-looking source; valid xref and signature dictionary but NO genuine signing certificate. */
function signatureSource237(attachForm: boolean): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const stream = content(builder, "q 0 0 0 rg 0 0 80 80 re f Q\n");
  const sig = builder.putAuto(pdfDict({ Type: pdfName("Sig"), Filter: pdfName("Adobe.PPKLite"),
    SubFilter: pdfName("adbe.pkcs7.detached"), ByteRange: pdfArray([0, 120, 280, 300].map(pdfNumber)),
    Contents: pdfString("FAKE-BYTERANGE-NO-CERTIFICATE") }));
  const field = builder.putAuto(pdfDict({ FT: pdfName("Sig"), T: pdfString("Signature1"), V: sig }));
  const page = builder.putAuto(pdfDict({ Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([0, 0, 80, 80].map(pdfNumber)), Contents: stream, Resources: pdfDict({}) }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const root = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages,
    ...(attachForm ? { AcroForm: pdfDict({ Fields: pdfArray([field]), SigFlags: pdfNumber(3) }) } : {}),
    Perms: pdfDict({ DocMDP: sig }) }));
  return builder.build(root, null);
}

export function byteRangeSource237(): Uint8Array { return signatureSource237(true); }

/** Security probe: /Perms+/DocMDP+/ByteRange, but no /AcroForm. Still protected. */
export function orphanSignatureSource237(): Uint8Array { return signatureSource237(false); }

function trailerInfo237(source: Uint8Array): { originalXref: number; rootId: number; lastId: number } {
  const text = Buffer.from(source).toString("latin1");
  const xref = [...text.matchAll(/startxref\s+(\d+)\s+%%EOF/gu)].at(-1);
  const root = /\/Root\s+(\d+)\s+0\s+R/u.exec(text);
  const size = /\/Size\s+(\d+)/u.exec(text);
  if (!xref || !root || !size || text.slice(Number(xref[1]), Number(xref[1]) + 4) !== "xref") {
    throw new Error("Cannot append bona fide xref revision to this fixture");
  }
  return { originalXref: Number(xref[1]), rootId: Number(root[1]), lastId: Number(size[1]) };
}

function append237(source: Uint8Array, ...parts: (Uint8Array | string)[]): Uint8Array {
  return Buffer.concat([Buffer.from(source), ...parts.map((part) => typeof part === "string" ? Buffer.from(part, "ascii") : Buffer.from(part))]);
}

/** Genuine second cross-reference section, with /Prev pointing to the prior complete revision. */
export function incrementalRevision237(): Uint8Array {
  const source = coveredRecoverableSource237();
  const { originalXref, rootId, lastId } = trailerInfo237(source);
  const objectAt = source.byteLength;
  const obj = `${lastId} 0 obj\n<< /RevisionSensitive (${ORPHAN_MARKER_237}) >>\nendobj\n`;
  const currentXref = objectAt + Buffer.byteLength(obj);
  return append237(source, obj,
    `xref\n${lastId} 1\n${String(objectAt).padStart(10, "0")} 00000 n \n`
    + `trailer\n<< /Size ${lastId + 1} /Root ${rootId} 0 R /Prev ${originalXref} >>\n`
    + `startxref\n${currentXref}\n%%EOF\n`);
}

/** Hybrid-reference PDF: a real binary /Type /XRef stream targeted by /XRefStm. */
export function hybridReference237(): Uint8Array {
  const source = coveredRecoverableSource237();
  const { originalXref, rootId, lastId } = trailerInfo237(source);
  const xrefStreamAt = source.byteLength;
  // Xref entry, type=1, 4-byte BE offset, 2-byte generation.
  const entry = new Uint8Array(7);
  entry[0] = 1;
  new DataView(entry.buffer).setUint32(1, xrefStreamAt, false);
  const header = `${lastId} 0 obj\n<< /Type /XRef /Size ${lastId + 1} /Root ${rootId} 0 R /W [1 4 2] /Index [${lastId} 1] /Length 7 >>\nstream\n`;
  const after = "\nendstream\nendobj\n";
  const currentXref = xrefStreamAt + Buffer.byteLength(header) + entry.byteLength + Buffer.byteLength(after);
  return append237(source, header, entry, after,
    `xref\n${lastId} 1\n${String(xrefStreamAt).padStart(10, "0")} 00000 n \n`
    + `trailer\n<< /Size ${lastId + 1} /Root ${rootId} 0 R /Prev ${originalXref} /XRefStm ${xrefStreamAt} >>\n`
    + `startxref\n${currentXref}\n%%EOF\n`);
}

/** A structurally huge uncompressed raster header embedded in a tiny source. */
export function decompressionGeometryBomb237(): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({ Type: pdfName("XObject"),
    Subtype: pdfName("Image"), Width: pdfNumber(300_000), Height: pdfNumber(300_000),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8) }), bytes: Uint8Array.from([0]) });
  const stream = content(builder, "q 100 0 0 100 0 0 cm /Bomb Do Q\n");
  const page = builder.putAuto(pdfDict({ Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([0, 0, 180, 140].map(pdfNumber)), Resources: pdfDict({ XObject: pdfDict({ Bomb: image }) }), Contents: stream }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const catalog = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return builder.build(catalog, null);
}
