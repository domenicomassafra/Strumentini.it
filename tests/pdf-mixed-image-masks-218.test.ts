import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { pdfImageCompositingRisk218 } from "../src/engines/pdf/image-aware-safety-218";
import { recompressPdfScannedImages } from "../src/engines/pdf/scan-image-aware";
import { recompressPdfEmbeddedJpegs } from "../src/engines/pdf/jpeg-image-aware";
import { nameValue, parsePdf } from "../src/engines/pdf/parser";
import { MIXED_218_TEXT, mixedImagePdf218, type Mixed218Scenario } from "./fixtures/pdf-mixed-masks-218";

const directory = resolve(import.meta.dirname, "fixtures/pdf-image-mixed-218");
const file = (scenario: Mixed218Scenario) => new Uint8Array(readFileSync(resolve(directory, `${scenario}-mixed-218.pdf`)));
const fingerprint = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function pdfjsRender218(bytes: Uint8Array) {
  const loader = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true, disableFontFace: true });
  try {
    const doc = await loader.promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport,
      background: "rgb(255,255,255)" }).promise;
    const text = (await page.getTextContent()).items.map((entry) => "str" in entry ? entry.str : "").join("");
    page.cleanup();
    return { png: canvas.toBuffer("image/png"), text, size: [canvas.width, canvas.height] };
  } finally { await loader.destroy(); }
}

describe("#218 adversarial actual mixed JPEG+PNG-style Flate image corpus", () => {
  it("pins seven real binary PDF XObject fixtures byte-for-byte to generators", async () => {
    for (const scenario of ["safe", "smask", "multiply", "form", "indexed", "bomb", "uniform"] as const) {
      expect(fingerprint(file(scenario)), scenario).toBe(fingerprint(await mixedImagePdf218(scenario)));
    }
  });

  it("pypdf independently reopens all mixed PDFs and reports JPEG/PNG predictors/color graph", () => {
    const script = String.raw`
import sys
from pypdf import PdfReader
for filename in sys.argv[1:]:
    reader = PdfReader(filename, strict=True)
    assert len(reader.pages) == 1, filename
    page = reader.pages[0]
    assert 'SEARCHABLE_MIXED_VECTOR_TEXT_218' in page.extract_text(), filename
    xo = page['/Resources']['/XObject']
    assert '/ImJpeg' in xo and '/ImFlate' in xo, filename
    jpeg = xo['/ImJpeg'].get_object()
    flate = xo['/ImFlate'].get_object()
    assert jpeg['/Filter'] == '/DCTDecode' and jpeg['/ColorSpace'] == '/DeviceRGB'
    assert flate['/Filter'] == '/FlateDecode' and flate['/DecodeParms']['/Predictor'] == 15
    if 'smask' in filename:
        assert xo['/ImMask'].get_object()['/SMask'].get_object()['/ColorSpace'] == '/DeviceGray'
    if 'multiply' in filename:
        assert page['/Resources']['/ExtGState']['/BM1'].get_object()['/BM'] == '/Multiply'
    if 'indexed' in filename:
        assert xo['/ImIndexed'].get_object()['/ColorSpace'][0] == '/Indexed'
print('PYPDF_218_SOURCES_PASS', len(sys.argv)-1)
`;
    const names = ["safe", "smask", "multiply", "form", "indexed", "bomb", "uniform"] as const;
    const result = execFileSync("python3", ["-c", script, ...names.map((s) => resolve(directory, `${s}-mixed-218.pdf`))],
      { encoding: "utf8", timeout: 10_000 });
    expect(result).toContain("PYPDF_218_SOURCES_PASS 7");
  });

  it.each([
    ["smask", "indirect-image-mask-compositing-unsupported"],
    ["multiply", "page-extgstate-compositing-unsupported"],
    ["form", "nested-form-xobject-compositing-unsupported"],
  ] as const)("fail-closes entire %s document, preserving input and independent PDF.js pixels", async (scenario, reason) => {
    const source = file(scenario), immutable = source.slice();
    const model = parsePdf(source);
    expect(pdfImageCompositingRisk218(model)).toBe(reason);
    const before = await pdfjsRender218(source);
    expect(before.text).toContain(MIXED_218_TEXT);
    for (const result of [await recompressPdfScannedImages(source), await recompressPdfEmbeddedJpegs(source)]) {
      expect(result.analysis.touched).toBe(0);
      expect(result.analysis.recommendOriginal).toBe(true);
      expect(result.analysis.inventory.every(({ action, reason: actual }) => action === "unchanged" && actual === reason)).toBe(true);
      expect(fingerprint(result.artifact.bytes)).toBe(fingerprint(source));
      expect((await pdfjsRender218(result.artifact.bytes)).png).toEqual(before.png);
    }
    expect(source).toEqual(immutable);
  }, 30_000);

  it("safe mixed PNG-style Flate and JPEG layers stay independently renderable and searchable", async () => {
    const source = file("safe"), model = parsePdf(source);
    expect(pdfImageCompositingRisk218(model)).toBeNull();
    const images = [...model.objects.values()].filter((obj) => obj.value.kind === "stream" &&
      nameValue(obj.value.dictionary.entries.get("Subtype")) === "Image");
    expect(images).toHaveLength(2);
    const jpeg = images.find((obj) => obj.value.kind === "stream" && nameValue(obj.value.dictionary.entries.get("Filter")) === "DCTDecode");
    expect(jpeg?.value.kind).toBe("stream");
    if (jpeg?.value.kind === "stream") expect((await sharp(jpeg.value.bytes).metadata()).format).toBe("jpeg");
    const rendered = await pdfjsRender218(source);
    expect(rendered.text).toContain(MIXED_218_TEXT);
    expect(rendered.size).toEqual([360, 360]);
    expect(rendered.png.byteLength).toBeGreaterThan(1000);
  });

  it("pre-abort both compression paths before canvas/codec allocation", async () => {
    const source = file("safe"), controller = new AbortController();
    controller.abort();
    await expect(recompressPdfScannedImages(source, { quality: .6, maxLongestEdgePx: 256 }, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    await expect(recompressPdfEmbeddedJpegs(source, { quality: .6 }, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });

  it("enforces argument bounds and bounded source bytes before allocating pixel buffers", async () => {
    const source = file("safe");
    await expect(recompressPdfScannedImages(source, { maxLongestEdgePx: 4097 })).rejects.toThrow(/INVALID_INPUT/u);
    await expect(recompressPdfEmbeddedJpegs(source, { quality: .95 })).rejects.toThrow(/INVALID_INPUT/u);
    const overLimit = new Uint8Array(25 * 1024 * 1024 + 1);
    await expect(recompressPdfScannedImages(overLimit)).rejects.toThrow(/PDF_LIMIT/u);
    await expect(recompressPdfEmbeddedJpegs(overLimit)).rejects.toThrow(/PDF_LIMIT/u);
  });

  it("does not guess effective DPI or assert safe compression ratio for already-small uniform layers", async () => {
    const source = file("uniform");
    const result = await recompressPdfScannedImages(source, { maxLongestEdgePx: 256 });
    expect(result.artifact.bytes).toEqual(source);
    expect(result.analysis).toMatchObject({ touched: 0, recommendOriginal: true });
    expect(result.analysis.savedBytes).toBe(0);
    expect(result.analysis.visualParity).toBe("not-verified-lossy");
  });
});
