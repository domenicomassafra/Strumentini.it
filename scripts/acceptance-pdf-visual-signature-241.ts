/** Independent desktop-only PDF.js raster evidence for #241.
 * This does not certify cryptographic signatures, browser UI or physical phones.
 * Run: npx tsx scripts/acceptance-pdf-visual-signature-241.ts
 */
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createSimplePdf } from "../src/engines/pdf/writer";
import { placeVisualSignature241 } from "../src/engines/pdf/visual-signature-241";

async function renderSample(bytes: Uint8Array, pageNumber: number, x: number, y: number): Promise<number[]> {
  const loading = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true, disableFontFace: true });
  try {
    const pdf = await loading.promise;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context as never, viewport, canvas: canvas as never }).promise;
    const rgba = Array.from(context.getImageData(x, y, 1, 1).data);
    page.cleanup();
    return rgba;
  } finally { await loading.destroy(); }
}

const rgba = new Uint8Array(16 * 8 * 4);
for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
  const offset = (y * 16 + x) * 4;
  rgba.set(y < 4 ? [230, 12, 32, 255] : [11, 240, 18, 0], offset);
}
const png = new Uint8Array(await sharp(rgba, { raw: { width: 16, height: 8, channels: 4 } }).png().toBuffer());
const source = createSimplePdf(["FIRST_SOURCE241", "SECOND_SOURCE241", "THIRD_SOURCE241"], { width: 300, height: 400 });
const result = placeVisualSignature241(source, { png, pages: "2", rect: [100, 100, 200, 160] });
assert.equal(result.plan.capability, "VISIBLE_IMAGE_ONLY_NO_CRYPTOGRAPHIC_SIGNATURE");
assert.deepEqual(result.plan.pages, [2]);
const sourceBackground = await renderSample(source, 2, 150, 255);
const untouchedPage = await renderSample(result.artifact.bytes, 1, 150, 255);
const opaqueTop = await renderSample(result.artifact.bytes, 2, 150, 255);
const transparentBottom = await renderSample(result.artifact.bytes, 2, 150, 285);
const untouchedThird = await renderSample(result.artifact.bytes, 3, 150, 255);
assert(sourceBackground.slice(0, 3).every((value) => value >= 245), "Background source pixel not white");
assert(untouchedPage.slice(0, 3).every((value) => value >= 245), "Page 1 was modified visibly");
assert(untouchedThird.slice(0, 3).every((value) => value >= 245), "Page 3 was modified visibly");
assert(opaqueTop[0]! >= 210 && opaqueTop[1]! < 45 && opaqueTop[2]! < 65,
  `Page 2 opaque ink not rendered correctly: ${opaqueTop}`);
assert(transparentBottom.slice(0, 3).every((value) => value >= 245),
  `Page 2 SMask did not preserve transparency: ${transparentBottom}`);
console.log(JSON.stringify({ status: "PASS", ticket: 241, proof: "PDF.js independently rendered real output PDF onto native canvas",
  placement: [100, 100, 200, 160], signed: false, pages: 3, sourceBackground,
  page1: untouchedPage, page2Opaque: opaqueTop, page2Transparent: transparentBottom,
  page3: untouchedThird, browser: "NOT_RUN", physical: "NOT_RUN" }, null, 2));
