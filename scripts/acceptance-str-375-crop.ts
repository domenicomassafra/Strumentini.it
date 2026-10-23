/** STR-375 independent Poppler + pdf-lib rotated crop acceptance. Run with tsx on macOS. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { degrees, PDFDocument, rgb } from "pdf-lib";
import { insertPdfImage375 } from "../src/engines/pdf/image-placement-375";

function render(source: Uint8Array) {
  const result = spawnSync("pdftoppm", ["-cropbox", "-f", "1", "-l", "1", "-r", "72", "-png", "-singlefile", "-"], {
    input: Buffer.from(source), maxBuffer: 10_000_000, timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr?.toString().slice(0, 400));
  assert(result.stdout.length > 400, "Poppler must write a PNG");
  return sharp(result.stdout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}
const doc = await PDFDocument.create();
const page = doc.addPage([600, 800]);
page.setCropBox(40, 60, 420, 300);
page.setRotation(degrees(90));
page.drawText("UNCHANGED-STR375", { x: 70, y: 160 });
const customer = doc.getForm().createTextField("customer");
customer.setText("PRESERVED");
customer.addToPage(page, { x: 65, y: 90, width: 110, height: 24 });
const source = await doc.save({ useObjectStreams: false });
const pristine = source.slice();
const placement = { page: 1, x: .12, y: .2, width: .25, rotation: 90 as const };
const raster = new Uint8Array(readFileSync("quality/fixtures/image-metadata/workspace-overlay-red-2x2.png"));
const output = await insertPdfImage375(source, raster, placement, "crop.pdf");
assert.deepEqual(source, pristine);
const reopened = await PDFDocument.load(output.bytes);
assert.equal(reopened.getPage(0).getRotation().angle, 90);
assert.deepEqual(reopened.getPage(0).getCropBox(), { x: 40, y: 60, width: 420, height: 300 });
assert.equal(reopened.getPage(0).node.Annots()?.size(), 1);
assert.equal(reopened.getForm().getTextField("customer").getText(), "PRESERVED");
const [before, after] = await Promise.all([render(source), render(output.bytes)]);
assert.equal(after.info.width, before.info.width);
assert.equal(after.info.height, before.info.height);
console.log("rotated crop Poppler raster geometry", after.info.width, after.info.height);
let changes = 0, inside = 0, outside = 0;
const intended = { left: placement.x * before.info.width, top: placement.y * before.info.height,
  right: (placement.x + placement.width) * before.info.width };
const intendedHeight = placement.width * before.info.width;
for (let y = 0; y < before.info.height; y++) for (let x = 0; x < before.info.width; x++) {
  const offset = (y * before.info.width + x) * before.info.channels;
  const different = [0, 1, 2].some(channel => Math.abs(before.data[offset + channel]! - after.data[offset + channel]!) > 25);
  if (!different) continue;
  changes++;
  if (x >= intended.left - 3 && x <= intended.right + 3 &&
      y >= intended.top - 3 && y <= intended.top + intendedHeight + 3) inside++;
  else outside++;
}
assert(changes > 1000, "rotated crop image must visibly alter output");
assert(inside > changes * .90, "image differs outside the intended crop/rotation bounds: inside=" + inside + " outside=" + outside);
console.log("PASS rotated 90 crop: Poppler pixel changes=" + changes + " inside bounds=" + inside +
  " outside=" + outside + ", annotations, form, source bytes preserved");

// Independent second renderer: PDF.js with a native canvas (not pdf-lib or Poppler).
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { createCanvas } = await import("@napi-rs/canvas");
async function renderPdfJs(bytes: Uint8Array) {
  const loading = getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const document = await loading.promise;
    const page = await document.getPage(1);
    try {
      const viewport = page.getViewport({ scale: 1 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport }).promise;
      return sharp(canvas.toBuffer("image/png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    } finally { page.cleanup(); }
  } finally { await loading.destroy(); }
}
const [jsBefore, jsAfter] = await Promise.all([renderPdfJs(source), renderPdfJs(output.bytes)]);
assert.deepEqual([jsAfter.info.width, jsAfter.info.height],
  [after.info.width, after.info.height], "PDF.js and Poppler must agree on rotated crop geometry");
let jsChanges = 0, jsInside = 0;
for (let y = 0; y < jsBefore.info.height; y++) for (let x = 0; x < jsBefore.info.width; x++) {
  const offset = (y * jsBefore.info.width + x) * jsBefore.info.channels;
  if (![0, 1, 2].some(channel =>
    Math.abs(jsBefore.data[offset + channel]! - jsAfter.data[offset + channel]!) > 25)) continue;
  jsChanges++;
  if (x >= intended.left - 3 && x <= intended.right + 3 &&
      y >= intended.top - 3 && y <= intended.top + intendedHeight + 3) jsInside++;
}
assert(jsChanges > 1000, "PDF.js must independently see image insertion");
assert(jsInside > jsChanges * .90, "PDF.js pixel changes outside placement bounds");
assert(Math.abs(jsChanges - changes) < changes * .35,
  "Poppler/PDF.js object geometry differs: " + changes + " vs " + jsChanges);
console.log("PASS independent PDF.js vs Poppler: changed=" + jsChanges + "/" + changes +
  " pixels, PDF.js inside=" + jsInside + ", same crop geometry");

// A solid 2x2 raster proves bounds but cannot reveal a reversed rotation or
// incorrect alpha compositing. Check asymmetric RGBA quadrants in both renderers.
const oriented = await PDFDocument.create();
const orientedPage = oriented.addPage([600, 800]);
orientedPage.setCropBox(40, 60, 420, 300);
orientedPage.setRotation(degrees(90));
orientedPage.drawRectangle({ x: 40, y: 60, width: 420, height: 300,
  color: rgb(0.38, 0.38, 0.38) });
const orientedSource = await oriented.save({ useObjectStreams: false });
const originalOriented = orientedSource.slice();
const rgba = Buffer.alloc(24 * 12 * 4);
const quadrants = [
  [235, 20, 20, 255], [30, 210, 45, 128],
  [20, 50, 230, 255], [245, 210, 25, 96],
] as const;
for (let y = 0; y < 12; y++) for (let x = 0; x < 24; x++) {
  const color = quadrants[(y >= 6 ? 2 : 0) + (x >= 12 ? 1 : 0)]!;
  const offset = (y * 24 + x) * 4;
  for (let channel = 0; channel < 4; channel++) rgba[offset + channel] = color[channel]!;
}
const asymmetricPng = new Uint8Array(await sharp(rgba, { raw: {
  width: 24, height: 12, channels: 4,
} }).png().toBuffer());
const orientedPlacement = { page: 1, x: 0.12, y: 0.2, width: 0.24, rotation: 90 as const };
const orientedOutput = await insertPdfImage375(orientedSource, asymmetricPng, orientedPlacement, "orientation.pdf");
assert.deepEqual(orientedSource, originalOriented, "asymmetric fixture must preserve source bytes");
const screenWidth = 300, screenHeight = 420;
const boxWidth = screenWidth * orientedPlacement.width;
const boxHeight = boxWidth * 2; // Rotation 90 swaps the source's 24:12 aspect ratio.
const samples = [
  { name: "top left blue", u: 0.25, v: 0.25, color: quadrants[2] },
  { name: "top right red", u: 0.75, v: 0.25, color: quadrants[0] },
  { name: "bottom left translucent yellow", u: 0.25, v: 0.75, color: quadrants[3] },
  { name: "bottom right translucent green", u: 0.75, v: 0.75, color: quadrants[1] },
] as const;
const views = await Promise.all([
  Promise.all([render(orientedSource), render(orientedOutput.bytes)]),
  Promise.all([renderPdfJs(orientedSource), renderPdfJs(orientedOutput.bytes)]),
]);
function pixel(view: Awaited<ReturnType<typeof render>>, x: number, y: number): number[] {
  const start = (y * view.info.width + x) * view.info.channels;
  return Array.from(view.data.subarray(start, start + 3));
}
for (const [index, [background, composite]] of views.entries()) {
  assert.deepEqual([composite.info.width, composite.info.height], [screenWidth, screenHeight]);
  for (const { name, u, v, color } of samples) {
    const x = Math.floor(orientedPlacement.x * screenWidth + u * boxWidth);
    const y = Math.floor(orientedPlacement.y * screenHeight + v * boxHeight);
    const before = pixel(background, x, y), after = pixel(composite, x, y);
    const alpha = color[3] / 255;
    for (let channel = 0; channel < 3; channel++) {
      const expected = color[channel]! * alpha + before[channel]! * (1 - alpha);
      assert(Math.abs(after[channel]! - expected) <= 30,
        (index === 0 ? "Poppler" : "PDF.js") + " " + name + " channel " + channel +
        ": expected " + Math.round(expected) + ", got " + after[channel]);
    }
  }
}
console.log("PASS asymmetric clockwise 90° + RGBA alpha: four directional quadrants in Poppler and PDF.js, source unchanged");
