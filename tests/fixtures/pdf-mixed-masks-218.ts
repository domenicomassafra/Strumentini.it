/** Independent reproducible actual PDF sources for #218, not mock image dictionaries.
 * /DCTDecode JPEG + /FlateDecode PNG Sub predictor and grayscale/Indexed XObjects.
 */
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { PdfBuilder } from "../../src/engines/pdf/writer";
import { pdfArray, pdfDict, pdfName, pdfNumber, pdfString } from "../../src/engines/pdf/parser";

export const MIXED_218_TEXT = "SEARCHABLE_MIXED_VECTOR_TEXT_218";
export const MIXED_218_WIDTH = 360;
export const MIXED_218_HEIGHT = 280;
export type Mixed218Scenario = "safe" | "smask" | "multiply" | "form" | "indexed" | "bomb" | "uniform";

function rgb218(uniform = false): Uint8Array {
  const pixels = new Uint8Array(MIXED_218_WIDTH * MIXED_218_HEIGHT * 3);
  let state = 0x239c498f;
  for (let y = 0; y < MIXED_218_HEIGHT; y++) for (let x = 0; x < MIXED_218_WIDTH; x++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const at = (y * MIXED_218_WIDTH + x) * 3;
    const value = uniform ? 154 : state & 255;
    pixels.set([value, uniform ? 154 : (x * 17 + y * 7 + (state >>> 8)) & 255,
      uniform ? 154 : (x * 3 + y * 29 + (state >>> 16)) & 255], at);
  }
  return pixels;
}

/** Real PNG predictor /DecodeParms 15: each row has Sub-filter byte 1. */
function pngPredictorSub218(rgb: Uint8Array): Uint8Array {
  const stride = MIXED_218_WIDTH * 3;
  const bytes = new Uint8Array(MIXED_218_HEIGHT * (stride + 1));
  for (let y = 0; y < MIXED_218_HEIGHT; y++) {
    const row = y * stride;
    bytes[y * (stride + 1)] = 1;
    for (let x = 0; x < stride; x++) bytes[y * (stride + 1) + 1 + x] = (rgb[row + x]! - (x >= 3 ? rgb[row + x - 3]! : 0)) & 255;
  }
  return bytes;
}

export async function mixedImagePdf218(scenario: Mixed218Scenario): Promise<Uint8Array> {
  const builder = new PdfBuilder();
  const catalog = builder.reserve(), pages = builder.reserve(), page = builder.reserve();
  const raw = rgb218(scenario === "uniform");
  const jpeg = new Uint8Array(await sharp(raw, { raw: { width: MIXED_218_WIDTH, height: MIXED_218_HEIGHT, channels: 3 } })
    .jpeg({ quality: scenario === "uniform" ? 50 : 100, chromaSubsampling: "4:4:4" }).toBuffer());
  const jpegImage = builder.putAuto({ kind: "stream", dictionary: pdfDict({ Type: pdfName("XObject"),
    Subtype: pdfName("Image"), Width: pdfNumber(MIXED_218_WIDTH), Height: pdfNumber(MIXED_218_HEIGHT),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("DCTDecode") }), bytes: jpeg });
  const flate = builder.putAuto({ kind: "stream", dictionary: pdfDict({ Type: pdfName("XObject"),
    Subtype: pdfName("Image"), Width: pdfNumber(MIXED_218_WIDTH), Height: pdfNumber(MIXED_218_HEIGHT),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
    DecodeParms: pdfDict({ Predictor: pdfNumber(15), Colors: pdfNumber(3),
      Columns: pdfNumber(MIXED_218_WIDTH), BitsPerComponent: pdfNumber(8) }) }),
    bytes: new Uint8Array(deflateSync(pngPredictorSub218(raw))) });
  // Real 8-bit grayscale alpha soft mask. Its reference is a graph dependency,
  // not a harmless tagged Image XObject. Engines must skip *all* rewrites.
  const alpha = new Uint8Array(MIXED_218_WIDTH * MIXED_218_HEIGHT);
  for (let y = 0; y < MIXED_218_HEIGHT; y++) for (let x = 0; x < MIXED_218_WIDTH; x++) {
    alpha[y * MIXED_218_WIDTH + x] = (x * 255 / (MIXED_218_WIDTH - 1)) | 0;
  }
  const softMask = scenario === "smask" ? builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"),
    Width: pdfNumber(MIXED_218_WIDTH), Height: pdfNumber(MIXED_218_HEIGHT),
    ColorSpace: pdfName("DeviceGray"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
  }), bytes: new Uint8Array(deflateSync(alpha)) }) : null;
  const masked = softMask === null ? null : builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(MIXED_218_WIDTH), Height: pdfNumber(MIXED_218_HEIGHT),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("DCTDecode"), SMask: softMask,
  }), bytes: jpeg });
  const state = scenario === "multiply" ? builder.putAuto(pdfDict({ Type: pdfName("ExtGState"),
    BM: pdfName("Multiply"), ca: pdfNumber(0.55), CA: pdfNumber(0.55) })) : null;
  const indexed = scenario === "indexed" ? builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(16), Height: pdfNumber(16),
    ColorSpace: pdfArray([pdfName("Indexed"), pdfName("DeviceRGB"), pdfNumber(1),
      pdfString(String.fromCharCode(11, 95, 26, 110, 33, 100))]),
    BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
  }), bytes: new Uint8Array(deflateSync(Uint8Array.from({ length: 256 }, (_, i) => i % 2))) }) : null;
  const subform = scenario === "form" ? builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Form"), FormType: pdfNumber(1),
    BBox: pdfArray([0, 0, 120, 90].map(pdfNumber)), Resources: pdfDict({}),
  }), bytes: new TextEncoder().encode("q 0 1 0 rg 10 10 80 45 re f Q\n") }) : null;
  const huge = scenario === "bomb" ? builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(100_000), Height: pdfNumber(100_000),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
  }), bytes: new Uint8Array(deflateSync(new Uint8Array([17, 81, 33]))) }) : null;
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const content = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(
    `q 180 0 0 140 0 0 cm /ImJpeg Do Q\nq ${state ? "/BM1 gs " : ""}180 0 0 140 180 0 cm /ImFlate Do Q\n`
    + (masked ? "q 75 0 0 56 100 170 cm /ImMask Do Q\n" : "")
    + (indexed ? "q 32 0 0 32 300 170 cm /ImIndexed Do Q\n" : "")
    + (subform ? "q 1 0 0 1 80 163 cm /Fm1 Do Q\n" : "")
    + `BT /F1 13 Tf 20 335 Td (${MIXED_218_TEXT}) Tj ET\n`,
  ) });
  builder.put(page, pdfDict({ Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([0, 0, 360, 360].map(pdfNumber)),
    Resources: pdfDict({ Font: pdfDict({ F1: font }), XObject: pdfDict({
      ImJpeg: jpegImage, ImFlate: flate, ...(masked ? { ImMask: masked } : {}),
      ...(indexed ? { ImIndexed: indexed } : {}), ...(subform ? { Fm1: subform } : {}),
      // Bomb is intentionally NOT referenced or rendered. Source preflight
      // currently does not make global image dimension claims for JPEG mode.
      ...(huge ? { ImBomb: huge } : {}),
    }), ...(state ? { ExtGState: pdfDict({ BM1: state }) } : {}) }), Contents: content,
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  builder.put(catalog, pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return builder.build(catalog, null);
}
