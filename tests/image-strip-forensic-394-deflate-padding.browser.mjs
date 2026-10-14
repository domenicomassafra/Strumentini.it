/**
 * #394: actual RGBA8 PNG zlib stored-block alignment fields can carry hidden
 * private bytes while strict CRC/Adler/decompression and RGBA agree. The
 * delivered output must be freshly canonicalized from decoded pixels.
 */
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { build } from "esbuild";
import { chromium, webkit } from "@playwright/test";
import sharp from "sharp";

const secret = Buffer.from("PRIVATE_EXIF_GPS_XMP_394_DEFLATE_PADDING_R8", "ascii");
const rgba = Buffer.from([22, 70, 101, 255, 170, 12, 88, 255, 32, 205, 99, 255, 200, 215, 7, 255]);
const source = await sharp(rgba, { raw: { width: 2, height: 2, channels: 4 } }).png({ palette: false }).toBuffer();
const scanlines = Buffer.from([0, ...rgba.subarray(0, 8), 0, ...rgba.subarray(8)]);
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
function chunk(kind, data) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length);
  bytes.write(kind, 4, 4, "ascii");
  data.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
}
function adler32(bytes) {
  let a = 1; let b = 0;
  for (const v of bytes) { a = (a + v) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}
const bits = [...secret].flatMap((value) => Array.from({ length: 8 }, (_, i) => (value >>> (7 - i)) & 1));
const ignored = [];
for (let at = 0; at < bits.length; at += 5) {
  let five = 0;
  for (let i = 0; i < 5; i++) five |= (bits[at + i] ?? 0) << i;
  ignored.push(Buffer.from([five << 3, 0, 0, 255, 255]));
}
const len = scanlines.length;
const storedFinal = Buffer.concat([
  Buffer.from([1, len & 255, len >> 8, (~len) & 255, ((~len) >> 8) & 255]),
  scanlines,
]);
const trailer = Buffer.alloc(4); trailer.writeUInt32BE(adler32(scanlines));
const zlib = Buffer.concat([Buffer.from([0x78, 0x01]), ...ignored, storedFinal, trailer]);
assert.deepEqual(inflateSync(zlib), scanlines, "independent native zlib fully verifies the forged stream");
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(2); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 6;
const tainted = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr), chunk("IDAT", zlib), chunk("IEND", Buffer.alloc(0)),
]);
assert.deepEqual(await sharp(tainted).ensureAlpha().raw().toBuffer(), rgba, "Sharp independent pixel identity");
// Reconstruct the concealed 5-bit chunks without looking at any visible pixel.
const recoveredBits = ignored.flatMap((block) => Array.from({ length: 5 }, (_, i) => (block[0] >>> (3 + i)) & 1));
const recovered = Buffer.alloc(secret.length);
for (let i = 0; i < secret.length * 8; i++) recovered[Math.floor(i / 8)] |= recoveredBits[i] << (7 - i % 8);
assert.deepEqual(recovered, secret, "real recoverable private marker in DEFLATE ignored alignment");

const built = await build({
  entryPoints: [new URL("../src/engines/image/strip-metadata.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "browser", format: "iife", globalName: "StripMetadata394",
});
let canonical;
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("about:blank");
    await page.addScriptTag({ content: built.outputFiles[0].text });
    const result = await page.evaluate(async ({ input, injected }) => {
      const source = new File([new Uint8Array(input)], "original.png", { type: "image/png" });
      const native = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(cb, mime, quality) {
        native.call(this, () => cb(new Blob([new Uint8Array(injected)], { type: "image/png" })), mime, quality);
      };
      try {
        const answer = await window.StripMetadata394.stripImageMetadataLocal({ file: source });
        return {
          verified: answer.metadataFree, bytes: [...new Uint8Array(await answer.blob.arrayBuffer())],
          segments: answer.outputInventory.segments, version: answer.engineVersion,
        };
      } finally { HTMLCanvasElement.prototype.toBlob = native; }
    }, { input: [...source], injected: [...tainted] });
    const output = Buffer.from(result.bytes);
    assert.equal(result.verified, true);
    assert.equal(result.version, "image-metadata-strip-v5");
    assert.deepEqual(result.segments, []);
    assert.notDeepEqual(output, tainted, "forged zlib representation MUST NOT be returned");
    assert.deepEqual(await sharp(output).ensureAlpha().raw().toBuffer(), rgba);
    if (canonical) assert.deepEqual(output, canonical, "same RGBA yields identical encoder-independent PNG");
    canonical = output;
    console.log(`#394 ${engine.name()} canonicalized forged DEFLATE ${tainted.length}→${output.length} bytes; recovered secret absent`);
  } finally { await browser.close(); }
}
