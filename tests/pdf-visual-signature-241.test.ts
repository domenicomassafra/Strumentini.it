import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { unzlibSync } from "fflate";
import { createSimplePdf, buildPdfFromPages } from "../src/engines/pdf/writer";
import { planVisualSignature241, placeVisualSignature241, decodeSignaturePng241, encodeSignatureCanvas241 } from "../src/engines/pdf/visual-signature-241";
import { nameValue, numberValue, parsePdf, pdfArray, pdfDict, pdfName, pdfNumber, pdfReference,
  resolveReference, type PdfPageNode, type PdfValue } from "../src/engines/pdf/parser";

const source = () => createSimplePdf(["FIRST_PAGE_SOURCE", "SECOND_PAGE_SOURCE", "THIRD_PAGE_SOURCE"], { width: 300, height: 400 });

async function pngFixture(channels: 3 | 4): Promise<Uint8Array> {
  // 16x8 independent input image. Upper half opaque red, lower half transparent
  // green: the /SMask must retain alpha rather than flattening green to white.
  const pixels = new Uint8Array(16 * 8 * channels);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    const index = (y * 16 + x) * channels;
    pixels.set(y < 4 ? [230, 12, 32] : [11, 240, 18], index);
    if (channels === 4) pixels[index + 3] = y < 4 ? 255 : 0;
  }
  return new Uint8Array(await sharp(pixels, { raw: { width: 16, height: 8, channels } }).png({ compressionLevel: 6 }).toBuffer());
}

function rotatedCrop(): Uint8Array {
  const doc = parsePdf(source());
  const pages = doc.pages.map((page, index): PdfPageNode => {
    if (index !== 1 || page.object.value.kind !== "dict") return page;
    return { ...page, object: { ...page.object, value: { ...page.object.value, entries: new Map([
      ...page.object.value.entries,
      ["CropBox", pdfArray([pdfNumber(20), pdfNumber(40), pdfNumber(280), pdfNumber(360)])],
      ["Rotate", pdfNumber(90)],
    ]) } } };
  });
  return buildPdfFromPages(pages.map((page) => ({ document: doc, page })), { flatten: false, compress: false });
}

function mutateCatalog(key: string, value: PdfValue): Uint8Array {
  const doc = parsePdf(source());
  if (!doc.root) throw new Error("Fixture root missing");
  const root = doc.objects.get(doc.root.id);
  if (!root || root.value.kind !== "dict") throw new Error("Fixture catalog missing");
  const objects = new Map(doc.objects);
  objects.set(root.id, { ...root, value: { ...root.value, entries: new Map([...root.value.entries, [key, value]]) } });
  const mutated = { ...doc, objects };
  return buildPdfFromPages(doc.pages.map((page) => ({ page, document: mutated })), { flatten: false, compress: false });
}

function contentStreams(bytes: Uint8Array) {
  const doc = parsePdf(bytes);
  return doc.pages.map((page) => {
    if (page.object.value.kind !== "dict") throw new Error("Bad page");
    const resolved = resolveReference(doc, page.object.value.entries.get("Contents"));
    const items = resolved?.kind === "array" ? resolved.items : [page.object.value.entries.get("Contents")];
    return items.map((item) => {
      const stream = resolveReference(doc, item);
      if (stream?.kind !== "stream") throw new Error("Bad stream");
      return stream.bytes;
    });
  });
}

describe("#241 bounded visible-appearance PNG overlays without cryptographic signing", () => {
  it("safely encodes drawn/text canvas pixels to bounded profile-free PNG and preserves transparency", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 230, 111, 9, 0]);
    const produced = encodeSignatureCanvas241(rgba, 2, 1);
    const decoded = decodeSignaturePng241(produced);
    expect(decoded).toMatchObject({ width: 2, height: 1, channels: 4 });
    expect([...decoded.rgb]).toEqual([10, 20, 30, 230, 111, 9]);
    expect([...decoded.alpha!]).toEqual([255, 0]);
    expect(() => encodeSignatureCanvas241(rgba, 2048, 2048)).toThrow(/PDF241_PNG_UNSUPPORTED/u);
    const invisible = encodeSignatureCanvas241(new Uint8ClampedArray(2 * 1 * 4), 2, 1);
    expect(() => decodeSignaturePng241(invisible)).toThrow(/totalmente trasparente/u);
  });
  it.each([3, 4] as const)("reopens RGB%s source + output, proves exact image RGB/alpha independently of image XObject", async (channels) => {
    const png = await pngFixture(channels);
    const image = decodeSignaturePng241(png);
    expect(image).toMatchObject({ width: 16, height: 8, channels });
    expect([...image.rgb.subarray(0, 3)]).toEqual([230, 12, 32]);
    expect([...image.rgb.subarray(image.rgb.length - 3)]).toEqual([11, 240, 18]);
    if (channels === 4) {
      expect(image.alpha?.[0]).toBe(255);
      expect(image.alpha?.at(-1)).toBe(0);
    }
    const sourceRaw = source(), frozen = sourceRaw.slice();
    const settings = { png, pages: "2,3", rect: [60, 40, 220, 120] as const };
    const { plan, artifact } = placeVisualSignature241(sourceRaw, settings);
    expect(sourceRaw).toEqual(frozen);
    expect(plan).toMatchObject({ pages: [2, 3], pageCount: 3, capability: "VISIBLE_IMAGE_ONLY_NO_CRYPTOGRAPHIC_SIGNATURE" });
    expect(artifact.filename).toContain("NON-digitale");
    const srcContents = contentStreams(sourceRaw), outContents = contentStreams(artifact.bytes);
    expect(outContents.map((entry) => entry.length)).toEqual([1, 4, 4]);
    srcContents.forEach((contents, at) => expect(outContents[at]![at === 0 ? 0 : 1]).toEqual(contents[0]));
    for (const placement of plan.placements) {
      expect(placement.matrix).toEqual([160, 0, 0, 80, 60, 40]);
      const streams = outContents[placement.page - 1]!;
      expect(new TextDecoder().decode(streams[0])).toBe("q\n");
      expect(new TextDecoder().decode(streams[2])).toBe("Q\n");
      expect(new TextDecoder().decode(streams[3])).toContain("/VS241Image Do");
    }
    const result = parsePdf(artifact.bytes);
    expect(result.text).not.toMatch(/\/(?:FT\s*\/Sig|ByteRange|AcroForm)\b/u);
    const picture = [...result.objects.values()].filter(({ value }) => value.kind === "stream"
      && nameValue(value.dictionary.entries.get("Subtype")) === "Image"
      && nameValue(value.dictionary.entries.get("ColorSpace")) === "DeviceRGB");
    expect(picture).toHaveLength(2);
    for (const item of picture) {
      if (item.value.kind !== "stream") throw new Error("Invalid output picture");
      const unpacked = unzlibSync(item.value.bytes);
      expect(unpacked).toEqual(image.rgb);
      const ref = item.value.dictionary.entries.get("SMask");
      if (channels === 4) {
        expect(ref?.kind).toBe("ref");
        const softMask = resolveReference(result, ref);
        expect(softMask?.kind).toBe("stream");
        if (softMask?.kind !== "stream") throw new Error("Missing soft mask");
        expect(nameValue(softMask.dictionary.entries.get("ColorSpace"))).toBe("DeviceGray");
        expect(unzlibSync(softMask.bytes)).toEqual(image.alpha);
      } else expect(ref).toBeUndefined();
    }
  });

  it("retains actual rotated CropBox geometry and places display-space rect within page bounds", async () => {
    const png = await pngFixture(4), input = rotatedCrop();
    const options = { png, pages: "2", rect: [4, 8, 104, 60] as const };
    const planned = planVisualSignature241(input, options);
    expect(planned.placements[0]).toMatchObject({ pageRotation: 90, displaySize: [320, 260] });
    expect(planned.placements[0]?.matrix).toEqual([0, 100, -52, 0, 272, 44]);
    const produced = placeVisualSignature241(input, options);
    const final = parsePdf(produced.artifact.bytes);
    expect(numberValue(final.pages[1]?.object.value.kind === "dict" ? final.pages[1].object.value.entries.get("Rotate") : undefined)).toBe(90);
    const rect = final.pages[1]?.object.value.kind === "dict" ? final.pages[1].object.value.entries.get("CropBox") : undefined;
    expect(rect?.kind).toBe("array");
    if (rect?.kind === "array") expect(rect.items.map(numberValue)).toEqual([20, 40, 280, 360]);
    expect(contentStreams(produced.artifact.bytes)[0]).toEqual(contentStreams(input)[0]);
  });

  it("refuses signature/form/certification and interactive catalogs before any image output", async () => {
    const png = await pngFixture(3), options = { png, pages: "1", rect: [30, 30, 140, 90] as const };
    for (const [key, value] of [
      ["AcroForm", pdfDict({ Fields: pdfArray([]) })],
      ["Perms", pdfDict({ DocMDP: pdfReference(1) })],
      ["Names", pdfDict({})],
      ["OpenAction", pdfDict({ S: pdfName("JavaScript") })],
    ] as const) {
      expect(() => placeVisualSignature241(mutateCatalog(key, value), options)).toThrow(/PDF241_(?:SIGNED_OR_FORM_REFUSED|UNSAFE_SOURCE)/u);
    }
    const doc = parsePdf(source());
    const page = doc.pages[0]!;
    if (page.object.value.kind !== "dict") throw new Error("Fixture page");
    const updated = { ...page, object: { ...page.object, value: { ...page.object.value,
      entries: new Map([...page.object.value.entries, ["Annots", pdfArray([])]]) } } };
    const withAnnotations = buildPdfFromPages(doc.pages.map((candidate, i) => ({ document: doc, page: i === 0 ? updated : candidate })), { flatten: false, compress: false });
    expect(() => placeVisualSignature241(withAnnotations, options)).toThrow(/PDF241_(?:SIGNED_OR_FORM_REFUSED|UNSAFE_SOURCE)/u);
  });

  it("refuses a genuinely encrypted AES-256 PDF without altering its bytes", async () => {
    const { createPdfToolkit } = await import("../src/engines/pdf/vendor/pdfstudio/index.js");
    const donor = await createPdfToolkit();
    const encrypted = await donor.lock(source(), { userPassword: "known-241-fixture", keyLength: 256 });
    expect(await donor.isEncrypted(encrypted)).toBe(true);
    const preserved = encrypted.slice();
    const png = await pngFixture(4);
    expect(() => placeVisualSignature241(encrypted, { png, pages: "1", rect: [40, 40, 150, 90] }))
      .toThrow(/PDF241_UNSAFE_SOURCE/u);
    expect(encrypted).toEqual(preserved);
  });

  it("refuses invalid geometry and original page range; no invisible/clipped appearance", async () => {
    const png = await pngFixture(3), pdf = source();
    for (const rect of [[0, 0, 0, 5], [-1, 2, 10, 20], [0, 0, 320, 100], [10, 10, Number.NaN, 20]]) {
      expect(() => placeVisualSignature241(pdf, { png, pages: "1", rect: rect as [number, number, number, number] })).toThrow(/PDF241_RECT_INVALID/u);
    }
    for (const pages of ["0", "4", "1,1", "3-2"]) {
      expect(() => placeVisualSignature241(pdf, { png, pages, rect: [2, 2, 30, 30] })).toThrow();
    }
    const cancelled = new AbortController(); cancelled.abort();
    expect(() => placeVisualSignature241(pdf, { png, pages: "1", rect: [1, 1, 40, 20] }, cancelled.signal)).toThrow(/annullata/iu);
  });

  it("rejects CRC corruption, misleading type, unsupported palette/gray/ICC metadata and oversized images", async () => {
    const png = await pngFixture(4);
    const corrupted = png.slice(); corrupted[corrupted.length - 8] = (corrupted[corrupted.length - 8] ?? 0) ^ 0x01;
    expect(() => decodeSignaturePng241(corrupted)).toThrow(/PDF241_PNG_CRC/u);
    expect(() => decodeSignaturePng241(new Uint8Array([0xff, 0xd8, 0xff]))).toThrow(/PDF241_PNG_UNSUPPORTED/u);
    // Recalculate PNG IHDR CRC so refusal is the unsupported grayscale type,
    // not a coincidental CRC failure.
    const gray = (await pngFixture(3)).slice();
    gray[25] = 0;
    const fixCrc = (bytes: Uint8Array) => {
      let crc = 0xffffffff;
      for (let i = 12; i < 29; i++) {
        crc ^= bytes[i]!;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(29, (crc ^ 0xffffffff) >>> 0);
    };
    fixCrc(gray);
    expect(() => decodeSignaturePng241(gray)).toThrow(/PDF241_PNG_UNSUPPORTED/u);
    const falseShort = (await pngFixture(4)).slice();
    new DataView(falseShort.buffer, falseShort.byteOffset).setUint32(16, 1);
    new DataView(falseShort.buffer, falseShort.byteOffset).setUint32(20, 1);
    fixCrc(falseShort);
    // Inflated raster exceeds declared 1x1 and must never be truncated into a valid signature.
    expect(() => decodeSignaturePng241(falseShort)).toThrow(/PDF241_PNG_UNSUPPORTED/u);
    const huge = new Uint8Array(await sharp({ create: { width: 1024, height: 512, channels: 4, background: "red" } }).png().toBuffer());
    expect(() => decodeSignaturePng241(huge)).toThrow(/PDF241_PNG_UNSUPPORTED/u);
  });

  it("PDF.js independently reopens, reads original page text, and observes image-paint operator on selected pages", async () => {
    const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const png = await pngFixture(4);
    const artifact = placeVisualSignature241(source(), { png, pages: "2", rect: [80, 160, 220, 220] }).artifact;
    const loading = getDocument({ data: artifact.bytes.slice(), useSystemFonts: true, disableFontFace: true });
    const document = await loading.promise;
    try {
      expect(document.numPages).toBe(3);
      for (let n = 1; n <= 3; n++) {
        const page = await document.getPage(n);
        const text = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join("");
        expect(text).toContain(["FIRST_PAGE_SOURCE", "SECOND_PAGE_SOURCE", "THIRD_PAGE_SOURCE"][n - 1]);
        const operators = await page.getOperatorList();
        const imageOps = operators.fnArray.filter((op) => [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject].includes(op)).length;
        expect(imageOps > 0).toBe(n === 2);
        page.cleanup();
      }
    } finally { await loading.destroy(); }
  });
});
