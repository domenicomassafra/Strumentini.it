import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { degrees, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { insertPdfImage375, type PdfImagePlacement375 } from "../src/engines/pdf/image-placement-375";

type Geometry = { left: number; top: number; right: number; bottom: number };

async function renderBounds(bytes: Uint8Array): Promise<Geometry> {
  // PDF.js is installed by npm ci on Linux CI, while pdftoppm is a MiniPC-only
  // consumer oracle. The consumer acceptance separately compares both renderers.
  const loading = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const rendered = await (async () => {
    try {
      const document = await loading.promise;
      const page = await document.getPage(1);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvas: canvas as never,
          canvasContext: canvas.getContext("2d") as never, viewport }).promise;
        return canvas.toBuffer("image/png");
      } finally { page.cleanup(); }
    } finally { await loading.destroy(); }
  })();
  const { data, info } = await sharp(rendered).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const offset = (y * info.width + x) * info.channels;
    // Detect a clearly blue image against the otherwise empty white PDF page.
    if (data[offset]! > 160 || data[offset + 2]! < 180) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  expect(right).toBeGreaterThan(left + 5);
  return { left, top, right: right + 1, bottom: bottom + 1 };
}

describe("STR-375 acceptance: placed images retain visual scale", () => {
  it.each([
    { pageRotation: 0, imageRotation: 0, format: "png" },
    { pageRotation: 90, imageRotation: 0, format: "jpg" },
    { pageRotation: 180, imageRotation: 90, format: "png" },
    { pageRotation: 270, imageRotation: 270, format: "jpg" },
  ] as const)("renders correct bounding box with page $pageRotation / image $imageRotation / $format",
    async ({ pageRotation, imageRotation, format }) => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([300, 360]);
      page.setCropBox(35, 55, 220, 260);
      page.setRotation(degrees(pageRotation));
      const original = await doc.save({ useObjectStreams: false });
      const immutable = original.slice();
      const raster = sharp({
        create: { width: 40, height: 20, channels: 4,
          background: { r: 20, g: 60, b: 230, alpha: 0.8 } },
      });
      const image = new Uint8Array(format === "png"
        ? await raster.png().toBuffer() : await raster.jpeg({ quality: 95 }).toBuffer());
      const placement: PdfImagePlacement375 = {
        page: 1, x: 0.12, y: 0.2, width: 0.3, rotation: imageRotation,
      };
      const output = await insertPdfImage375(original, image, placement, "fixture.pdf");
      expect(original).toEqual(immutable);
      const reopened = await PDFDocument.load(output.bytes);
      expect(reopened.getPage(0).getRotation().angle).toBe(pageRotation);
      expect(reopened.getPage(0).getCropBox()).toEqual({ x: 35, y: 55, width: 220, height: 260 });
      const displayWidth = pageRotation % 180 === 0 ? 220 : 260;
      const displayHeight = pageRotation % 180 === 0 ? 260 : 220;
      const expectedWidth = placement.width * displayWidth;
      const expectedHeight = expectedWidth * (imageRotation % 180 === 0 ? 0.5 : 2);
      const actual = await renderBounds(output.bytes);
      const expected = { left: placement.x * displayWidth,
        top: placement.y * displayHeight,
        right: placement.x * displayWidth + expectedWidth,
        bottom: placement.y * displayHeight + expectedHeight };
      for (const edge of ["left", "top", "right", "bottom"] as const) {
        expect(Math.abs(actual[edge] - expected[edge]), edge + " actual=" +
          JSON.stringify(actual) + " expected=" + JSON.stringify(expected)).toBeLessThanOrEqual(3);
      }
      if (format === "png") {
        const objects = reopened.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
        expect(objects).toBeDefined();
        const masks = objects!.entries().map(([, ref]) =>
          (reopened.context.lookup(ref) as { dict?: PDFDict }).dict?.get(PDFName.of("SMask")));
        expect(masks.some(Boolean), "alpha transparency must remain a PDF soft mask").toBe(true);
      }
    });
});
