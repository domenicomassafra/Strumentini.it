/**
 * #394: PNG PLTE bytes must not smuggle a hidden source identifier while a
 * metadata-stripper claims the actual exported bytes are metadata-free.
 * Read-only browser fixture, no provider/filesystem extraction or deployment.
 * Run: node tests/image-strip-forensic-394-unused-palette.browser.mjs
 */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, webkit } from "@playwright/test";
import sharp from "sharp";

const secret = Buffer.from("PRIVATE_GPS_EXIF_XMP_394_PALETTE");
const rgba = Buffer.from([23, 45, 67, 255, 201, 42, 78, 255, 8, 190, 110, 255, 16, 27, 225, 255]);
const source = await sharp(rgba, { raw: { width: 2, height: 2, channels: 4 } })
  .png({ palette: false, compressionLevel: 1 }).toBuffer();
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, payload) {
  const part = Buffer.alloc(12 + payload.length);
  part.writeUInt32BE(payload.length, 0);
  part.write(type, 4, "ascii");
  payload.copy(part, 8);
  part.writeUInt32BE(crc32(part.subarray(4, -4)), part.length - 4);
  return part;
}
function injectSuggestedPalette(bytes) {
  assert.deepEqual(bytes.subarray(0, 8), signature);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
  const ihdrLength = bytes.readUInt32BE(8);
  assert.equal(bytes[8 + 8 + 9], 6, "fixture must be truecolor+alpha, not indexed palette");
  const afterIhdr = 8 + 12 + ihdrLength;
  const paddedSecret = Buffer.concat([secret, Buffer.alloc((3 - secret.length % 3) % 3)]);
  const forged = Buffer.concat([bytes.subarray(0, afterIhdr), chunk("PLTE", paddedSecret), bytes.subarray(afterIhdr)]);
  assert(forged.includes(secret));
  return forged;
}
const bundle = await build({
  entryPoints: [new URL("../src/engines/image/strip-metadata.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "browser", format: "iife", globalName: "StripMetadata394",
});
let genuineChromiumClean;
for (const browserType of [chromium, webkit]) {
  const browser = await browserType.launch({ headless: true });
  try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("about:blank");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  if (browserType === chromium) {
    genuineChromiumClean = await page.evaluate(async (encoded) => {
      const input = new File([new Uint8Array(encoded)], "original.png", { type: "image/png" });
      const result = await window.StripMetadata394.stripImageMetadataLocal({ file: input });
      return [...new Uint8Array(await result.blob.arrayBuffer())];
    }, [...source]);
  }
  // Only Chromium is certified for native output in this bounded test:
  // WebKit may emit extra vendor chunks and must fail closed there. Supply
  // the SAME independently checked genuine Chromium bytes as an encoder
  // callback to probe WebKit's actual unpacking/forensic consumer boundary.
  const clean = genuineChromiumClean;
  assert(clean, "A genuine clean Chromium output must precede this check");
  const forged = injectSuggestedPalette(Buffer.from(clean));
  const native = await sharp(forged).ensureAlpha().raw().toBuffer();
  const pristine = await sharp(Buffer.from(clean)).ensureAlpha().raw().toBuffer();
  assert.deepEqual(native, pristine, "Independent Sharp decoder must see EXACT unchanged pixels");
  const result = await page.evaluate(async ({ encoded, forged }) => {
    const blob = new Blob([new Uint8Array(forged)], { type: "image/png" });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    const realPixels = [...canvas.getContext("2d").getImageData(0, 0, bitmap.width, bitmap.height).data];
    bitmap.close();
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      original.call(this, () => callback(blob), type, quality);
    };
    try {
      const input = new File([new Uint8Array(encoded)], "original.png", { type: "image/png" });
      const output = await window.StripMetadata394.stripImageMetadataLocal({ file: input });
      return { accepted: true, metadataFree: output.metadataFree, inventory: output.outputInventory, bytes: [...new Uint8Array(await output.blob.arrayBuffer())], realPixels };
    } catch (error) {
      return { accepted: false, error: String(error), realPixels };
    } finally {
      HTMLCanvasElement.prototype.toBlob = original;
    }
  }, { encoded: [...source], forged: [...forged] });
  assert.deepEqual(Buffer.from(result.realPixels), native, `${browserType.name()} also decodes forged PLTE to same pixels`);
  assert.equal(result.accepted, true, "Canonical RGBA output must not require native PNG serialization");
  assert.equal(result.metadataFree, true);
  assert.deepEqual(result.inventory.segments, []);
  const delivered = Buffer.from(result.bytes);
  assert.equal(delivered.includes(secret), false, "Delivered canonical PNG must not preserve injected PLTE");
  assert.deepEqual(await sharp(delivered).ensureAlpha().raw().toBuffer(), native);
  console.log(`#394 ${browserType.name()} native PLTE spoof ignored, delivered canonical PNG ${delivered.length}B, pixels exact`);
  } finally {
    await browser.close();
  }
}
