/**
 * #394 grayscale PNG unused-bit forensic regression.
 * A width-1, depth-1 image has only ONE visible pixel bit per scanline.
 * Remaining seven padding bits can carry a recoverable private string even
 * with a valid CRC/Adler/zlib stream and visually identical RGBA output.
 * Run: node tests/image-strip-forensic-394-grayscale-padding.browser.mjs
 */
import assert from "node:assert/strict";
import { deflateSync, inflateSync } from "node:zlib";
import { build } from "esbuild";
import { chromium, webkit } from "@playwright/test";
import sharp from "sharp";

const secret = Buffer.from("PRIVATE_GPS_EXIF_XMP_394_GRAYSCALE_PADDING_BITS", "ascii");
const bits = [...secret].flatMap((byte) => Array.from({ length: 8 }, (_, bit) => (byte >>> (7 - bit)) & 1));
const height = Math.ceil(bits.length / 7);
const rgba = Buffer.alloc(height * 4);
for (let i = 0; i < height; i++) rgba[i * 4 + 3] = 255;
const source = await sharp(rgba, { raw: { width: 1, height, channels: 4 } })
  .png({ palette: false }).toBuffer();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, payload) {
  const bytes = Buffer.alloc(payload.length + 12);
  bytes.writeUInt32BE(payload.length);
  bytes.write(type, 4, 4, "ascii");
  payload.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
}
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(1, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 1; // one-bit grayscale: 1 used + 7 unused bits per row
ihdr[9] = 0;
const pixels = Buffer.alloc(height * 2);
for (let row = 0; row < height; row++) {
  let encoded = 0;
  for (let bit = 0; bit < 7; bit++) encoded = (encoded << 1) | (bits[row * 7 + bit] ?? 0);
  pixels[row * 2] = 0; // PNG filter none
  pixels[row * 2 + 1] = encoded; // high visible pixel bit 0, low 7 secret
}
const tainted = Buffer.concat([
  signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0)),
]);
const unpacked = inflateSync(tainted.subarray(41, tainted.length - 16)); // framed IDAT content
const unpackedBits = Array.from({ length: height }, (_, row) => unpacked[row * 2 + 1])
  .flatMap((value) => Array.from({ length: 7 }, (_, bit) => (value >>> (6 - bit)) & 1));
const recovered = Buffer.alloc(secret.length);
for (let i = 0; i < secret.length * 8; i++) recovered[Math.floor(i / 8)] |= unpackedBits[i] << (7 - (i % 8));
assert.deepEqual(recovered, secret, "independently recover private source bytes from invisible PNG padding");
const sourceRgba = await sharp(source).ensureAlpha().raw().toBuffer();
const taintedRgba = await sharp(tainted).ensureAlpha().raw().toBuffer();
assert.deepEqual(taintedRgba, sourceRgba, "independent Sharp sees no pixel difference");

const bundle = await build({
  entryPoints: [new URL("../src/engines/image/strip-metadata.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "browser", format: "iife", globalName: "StripMetadata394",
});
for (const browserType of [chromium, webkit]) {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("about:blank");
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const actual = await page.evaluate(async ({ encoded, forged }) => {
      const blob = new Blob([new Uint8Array(forged)], { type: "image/png" });
      const bitmap = await createImageBitmap(blob);
      const surface = document.createElement("canvas");
      surface.width = bitmap.width;
      surface.height = bitmap.height;
      surface.getContext("2d").drawImage(bitmap, 0, 0);
      const pixels = [...surface.getContext("2d").getImageData(0, 0, bitmap.width, bitmap.height).data];
      bitmap.close();
      const native = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        native.call(this, () => callback(blob), type, quality);
      };
      try {
        const file = new File([new Uint8Array(encoded)], "clean.png", { type: "image/png" });
        const result = await window.StripMetadata394.stripImageMetadataLocal({ file });
        return { accepted: true, metadataFree: result.metadataFree, inventory: result.outputInventory, bytes: [...new Uint8Array(await result.blob.arrayBuffer())], pixels };
      } catch (error) {
        return { accepted: false, error: String(error), pixels };
      } finally {
        HTMLCanvasElement.prototype.toBlob = native;
      }
    }, { encoded: [...source], forged: [...tainted] });
    assert.deepEqual(Buffer.from(actual.pixels), sourceRgba, `${browserType.name()} genuine pixel decoder sees identity`);
    assert.equal(actual.accepted, true, "PNG pixels must be canonically encoded without native vendor representation");
    assert.equal(actual.metadataFree, true);
    assert.deepEqual(actual.inventory.segments, []);
    const delivered = Buffer.from(actual.bytes);
    assert.notDeepEqual(delivered, tainted);
    assert.deepEqual(await sharp(delivered).ensureAlpha().raw().toBuffer(), sourceRgba);
    console.log(`#394 ${browserType.name()} strips encoded grayscale padding by canonical RGBA delivery`);
  } finally {
    await browser.close();
  }
}
