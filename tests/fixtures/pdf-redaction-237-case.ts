import { pdfArray, pdfDict, pdfName, pdfNumber, pdfString } from "../../src/engines/pdf/parser";
import { PdfBuilder } from "../../src/engines/pdf/writer";

export const REDACTION_SECRET_237 = "SECRET-PAYLOAD-237-ONLY-IN-SOURCE-987654";
export const REDACTION_METADATA_237 = "SECRET-METADATA-237-ONLY-IN-SOURCE-456789";
export const REDACTION_RAW_IMAGE_237 = Uint8Array.from([173, 37, 242, 71, 191, 226, 13, 54, 215, 62, 153, 44]);

/** Two actual pages: upper red/secret text; lower blue+tiny source Image XObject; second green. */
export function redactionCasePdf237(options: { annotated?: boolean; attached?: boolean; encrypted?: boolean } = {}): Uint8Array {
  const builder = new PdfBuilder();
  const pagesRef = builder.reserve();
  const font = builder.putAuto(pdfDict({
    Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica"),
  }));
  const image = builder.putAuto({
    kind: "stream",
    dictionary: pdfDict({
      Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(2), Height: pdfNumber(2),
      ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8),
    }),
    bytes: REDACTION_RAW_IMAGE_237,
  });
  const colorBlocks = [
    `q 1 0 0 rg 0 100 200 100 re f 0 0 1 rg 0 0 200 100 re f Q
BT /F1 12 Tf 0 0 0 rg 2 158 Td (${REDACTION_SECRET_237}) Tj ET
q 18 0 0 18 8 8 cm /ImgSource Do Q
`,
    "q 0 1 0 rg 0 0 200 200 re f Q\n",
  ];
  const refPages = colorBlocks.map((content, index) => {
    const contentRef = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(content) });
    return builder.putAuto(pdfDict({
      Type: pdfName("Page"), Parent: pagesRef,
      MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(200), pdfNumber(200)]),
      Resources: pdfDict({ Font: pdfDict({ F1: font }), XObject: pdfDict({ ImgSource: image }) }),
      Contents: contentRef,
      ...(index === 0 && options.annotated ? { Annots: pdfArray([]) } : {}),
    }));
  });
  builder.put(pagesRef, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray(refPages), Count: pdfNumber(2) }));
  const catalog = builder.putAuto(pdfDict({
    Type: pdfName("Catalog"), Pages: pagesRef,
    ...(options.attached ? { Names: pdfDict({ EmbeddedFiles: pdfDict({}) }) } : {}),
  }));
  const info = builder.putAuto(pdfDict({ Title: pdfString(REDACTION_METADATA_237) }));
  const bytes = builder.build(catalog, info);
  if (!options.encrypted) return bytes;
  // Deliberately declare an unsupported encryption dictionary in the trailer
  // without purporting to implement encryption.
  const text = new TextDecoder("latin1").decode(bytes);
  return new TextEncoder().encode(text.replace(/\/Root (\d+ \d+ R)/u, "/Encrypt 77 0 R /Root $1"));
}
