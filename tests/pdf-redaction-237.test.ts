import { describe, expect, it } from "vitest";
import { parsePdf, pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import {
  assertSupportedSource237, blackenPixels237, validateRedactionPlan237, verifySecureRedaction237,
} from "../src/engines/pdf/secure-raster-redaction-237";
import {
  redactionCasePdf237, REDACTION_METADATA_237, REDACTION_RAW_IMAGE_237, REDACTION_SECRET_237,
} from "./fixtures/pdf-redaction-237-case";

const selected = [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }] as const;

describe("#237 security-first raster-only PDF redaction", () => {
  it("inspects real source text, metadata, original image and two pages before refusing unsafe features", () => {
    const source = redactionCasePdf237();
    const parsed = parsePdf(source);
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.text).toContain(REDACTION_SECRET_237);
    expect(parsed.text).toContain(REDACTION_METADATA_237);
    expect([...parsed.objects.values()].some(({ value }) => value.kind === "stream"
      && REDACTION_RAW_IMAGE_237.every((byte, i) => value.bytes[i] === byte))).toBe(true);
    expect(assertSupportedSource237(source)).toBe(2);
    validateRedactionPlan237(2, selected);
  });

  it.each([
    ["annotations", { annotated: true }],
    ["attachments", { attached: true }],
    ["encryption", { encrypted: true }],
  ] as const)("rejects %s before processing any source content", (_label, opts) => {
    expect(() => assertSupportedSource237(redactionCasePdf237(opts))).toThrow(/REDACTION_REFUSED/u);
  });

  it("fails closed on unsupported bytes, too many pages or oversized source", () => {
    expect(() => assertSupportedSource237(new TextEncoder().encode("not a PDF"))).toThrow(/REDACTION_REFUSED/u);
    expect(() => assertSupportedSource237(new Uint8Array(8 * 1024 * 1024 + 1))).toThrow(/REDACTION_REFUSED/u);
    expect(() => validateRedactionPlan237(0, selected)).toThrow(/REDACTION_REFUSED/u);
    expect(() => validateRedactionPlan237(5, selected)).toThrow(/REDACTION_REFUSED/u);
    expect(() => validateRedactionPlan237(2, [])).toThrow(/REDACTION_REFUSED/u);
  });

  it.each([
    [{ page: 0, left: 0, top: 0, width: 1, height: 1 }],
    [{ page: 3, left: 0, top: 0, width: 1, height: 1 }],
    [{ page: 1, left: -0.1, top: 0, width: 0.5, height: 0.5 }],
    [{ page: 1, left: 0.75, top: 0, width: 0.5, height: 0.5 }],
    [{ page: 1, left: 0, top: 0, width: 0, height: 1 }],
    [{ page: 1, left: 0, top: Number.NaN, width: 1, height: 1 }],
  ])("rejects invalid redaction regions %j", (rect) => {
    expect(() => validateRedactionPlan237(2, [rect])).toThrow(/REDACTION_REFUSED/u);
  });

  it("zeros exact pixel bytes within full normalized redaction and preserves outside RGB", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 205; pixels[i + 1] = 15; pixels[i + 2] = 98; pixels[i + 3] = 255;
    }
    const rgb = blackenPixels237(pixels, 4, 4, [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }]);
    expect(rgb.length).toBe(48);
    for (let p = 0; p < 16; p += 1) {
      expect(Array.from(rgb.subarray(p * 3, p * 3 + 3))).toEqual(p < 8 ? [0, 0, 0] : [205, 15, 98]);
    }
  });

  it("refuses output that still contains text/fonts even if its image pixels are black", async () => {
    const builder = new PdfBuilder();
    const pages = builder.reserve();
    const content = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode("BT (SECRET) Tj ET") });
    const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), BaseFont: pdfName("Helvetica") }));
    const page = builder.putAuto(pdfDict({
      Type: pdfName("Page"), MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(100), pdfNumber(100)]),
      Resources: pdfDict({ Font: pdfDict({ F0: font }) }), Contents: content,
    }));
    builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
    const root = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
    const output = builder.build(root, null);
    await expect(verifySecureRedaction237(output, [{
      page: 1, pageWidth: 100, pageHeight: 100, pixelWidth: 100, pixelHeight: 100,
      regions: [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
    }])).rejects.toThrow(/REDACTION_REFUSED/u);
  });

  it("independently inflates final RGB image and rejects one recovered pixel, orphan object or bytes after EOF", async () => {
    const spec = {
      page: 1, pageWidth: 10, pageHeight: 10, pixelWidth: 10, pixelHeight: 10,
      regions: [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }],
    };
    async function createRgbOnlyPdf(raster: Uint8Array, withOrphan = false): Promise<Uint8Array> {
      const compressed = new Uint8Array(await new Response(
        new Blob([Uint8Array.from(raster)]).stream().pipeThrough(new CompressionStream("deflate")),
      ).arrayBuffer());
      const writer = new PdfBuilder();
      const pages = writer.reserve();
      const image = writer.putAuto({
        kind: "stream",
        dictionary: pdfDict({
          Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(10), Height: pdfNumber(10),
          ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
        }),
        bytes: compressed,
      });
      const contents = writer.putAuto({
        kind: "stream", dictionary: pdfDict({}),
        bytes: new TextEncoder().encode("q\n10 0 0 10 0 0 cm\n/Im0 Do\nQ\n"),
      });
      const page = writer.putAuto(pdfDict({
        Type: pdfName("Page"), MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(10), pdfNumber(10)]),
        Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }), Contents: contents,
      }));
      writer.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
      const catalog = writer.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
      if (withOrphan) writer.putAuto(pdfDict({ JS: pdfName("HiddenAction") }));
      return writer.build(catalog, null);
    }
    const safe = new Uint8Array(10 * 10 * 3).fill(0);
    for (let p = 50; p < 100; p += 1) {
      safe[p * 3] = 20; safe[p * 3 + 1] = 50; safe[p * 3 + 2] = 90;
    }
    const good = await createRgbOnlyPdf(safe);
    await expect(verifySecureRedaction237(good, [spec])).resolves.toMatchObject({
      pageCount: 1, verifiedBlackPixels: 50, policy: "new-raster-only-lossless-flate-no-source-objects",
    });
    const leaked = safe.slice();
    leaked[12 * 3] = 19; // a single top-half redaction pixel has survived
    await expect(verifySecureRedaction237(await createRgbOnlyPdf(leaked), [spec]))
      .rejects.toThrow(/REDACTION_REFUSED: Un pixel oscurato/u);
    await expect(verifySecureRedaction237(await createRgbOnlyPdf(safe, true), [spec]))
      .rejects.toThrow(/REDACTION_REFUSED: Struttura PDF/u);
    const hiddenTail = Uint8Array.from([...good, ...new TextEncoder().encode("HIDDEN-AFTER-EOF")]);
    await expect(verifySecureRedaction237(hiddenTail, [spec])).rejects.toThrow(/REDACTION_REFUSED: Byte finali/u);
  });

  it("refuses malformed raster and never lets zero-area selection through", () => {
    expect(() => blackenPixels237(new Uint8ClampedArray(16), 5000, 5000, selected)).toThrow(/REDACTION_REFUSED/u);
    expect(() => validateRedactionPlan237(1, [{ page: 1, left: 0.5, top: 0, width: 0.51, height: 1 }]))
      .toThrow(/REDACTION_REFUSED/u);
  });

  it("rejects tiny compressed source files that declare memory-bomb image geometry", () => {
    const builder = new PdfBuilder();
    const pages = builder.reserve();
    const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
      Type: pdfName("XObject"), Subtype: pdfName("Image"),
      Width: pdfNumber(100_000), Height: pdfNumber(100_000),
      ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8),
    }), bytes: new Uint8Array([0]) });
    const contents = builder.putAuto({ kind: "stream", dictionary: pdfDict({}),
      bytes: new TextEncoder().encode("q /Im0 Do Q") });
    const page = builder.putAuto(pdfDict({ Type: pdfName("Page"),
      MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(100), pdfNumber(100)]),
      Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }), Contents: contents }));
    builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
    const catalog = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
    expect(() => assertSupportedSource237(builder.build(catalog, null)))
      .toThrow(/REDACTION_REFUSED: Raster sorgente/u);
  });
});
