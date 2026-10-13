/** #367: real PNG with two independently CRC-valid eXIf chunks (PNG forbids duplicates).
 * Run: node tests/image-codec-367-20261013-duplicate-exif.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import sharp from "sharp";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const { outputFiles } = await build({
  stdin: {
    contents: 'import { inspectImageHeader } from "./src/engines/image/format.ts"; window.inspect367 = inspectImageHeader;',
    resolveDir: root,
    loader: "ts",
    sourcefile: "duplicate-exif-367.ts",
  },
  write: false, bundle: true, format: "iife", platform: "browser", target: "es2022",
});
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src blob:; connect-src 'none'; object-src 'none'");
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end('<!doctype html><meta charset="utf-8"><script src="/source.js"></script>');
  }
  if (req.url === "/source.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    return res.end(outputFiles[0].text);
  }
  res.writeHead(404).end();
});
await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", done);
});
const origin = `http://127.0.0.1:${server.address().port}`;

function splitChunks(png) {
  const result = [];
  for (let at = 8; at + 12 <= png.length;) {
    const length = png.readUInt32BE(at);
    assert(at + 12 + length <= png.length, "Valid PNG chunk bounds");
    result.push({ type: png.toString("ascii", at + 4, at + 8), bytes: png.subarray(at, at + 12 + length),
      data: png.subarray(at + 8, at + 8 + length) });
    at += length + 12;
  }
  return result;
}
function pngChunk(type, data) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length, 0);
  bytes.write(type, 4, 4, "ascii");
  data.copy(bytes, 8);
  let crc = 0xffffffff;
  for (const byte of bytes.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length - 4);
  return bytes;
}
const raw = Buffer.alloc(6 * 4 * 3);
for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) {
  raw.set(x < 3 ? [225, y * 20, 0] : [0, y * 20, 225], (y * 6 + x) * 3);
}
const plain = await sharp(raw, { raw: { width: 6, height: 4, channels: 3 } }).png().toBuffer();
const oriented = await sharp(plain).withMetadata({ orientation: 6 }).png().toBuffer();
const validExif = splitChunks(oriented).find(c => c.type === "eXIf")?.data;
assert(validExif && validExif.length >= 22, "Sharp must emit a real eXIf TIFF");
assert.equal((await sharp(oriented).metadata()).orientation, 6);
const tiffEndian = validExif.subarray(0, 2).toString("ascii");
assert.equal(tiffEndian, "II", "Fixture expects checked Little Endian TIFF");
const ifd = validExif.readUInt32LE(4);
const entryCount = validExif.readUInt16LE(ifd);
assert(entryCount > 0 && ifd + 2 + entryCount * 12 <= validExif.length);
let orientationTag = -1;
for (let n = 0; n < entryCount; n++) {
  const at = ifd + 2 + n * 12;
  if (validExif.readUInt16LE(at) === 0x0112) orientationTag = at;
}
assert(orientationTag >= 0, "Sharp TIFF IFD0 must contain orientation tag");
assert.equal(validExif.readUInt16LE(orientationTag), 0x0112);

const unrecognizedTag = Buffer.from(validExif);
unrecognizedTag.writeUInt16LE(0x0113, orientationTag);
const malformedTiff = Buffer.from(validExif);
malformedTiff[0] = 0x12;
function withExifChunks(...chunks) {
  return Buffer.concat([
    plain.subarray(0, 8),
    ...splitChunks(plain).flatMap(c => c.type === "IHDR"
      ? [c.bytes, ...chunks.map(data => pngChunk("eXIf", data))] : [c.bytes]),
  ]);
}
const singleOrientation = withExifChunks(validExif);
const singleUnknownTag = withExifChunks(unrecognizedTag);
const unknownThenSix = withExifChunks(unrecognizedTag, validExif);
const malformedThenSix = withExifChunks(malformedTiff, validExif);
const sameOrientationTwice = withExifChunks(validExif, validExif);
assert.equal((await sharp(singleOrientation).metadata()).orientation, 6);
assert.equal((await sharp(singleUnknownTag).metadata()).orientation, undefined);
assert.equal((await sharp(unknownThenSix).metadata()).orientation, undefined);

let failures = 0;
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const offsite = [], errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => {
        if (route.request().method() === "GET" && route.request().url().startsWith(origin + "/")) return route.continue();
        offsite.push(route.request().url());
        return route.abort();
      });
      assert.equal((await page.goto(origin))?.status(), 200);
      const test = bytes => page.evaluate(async inputBytes => {
        const input = Uint8Array.from(inputBytes);
        let header;
        try { header = window.inspect367(input); }
        catch (error) { header = String(error); }
        const bitmap = await createImageBitmap(new Blob([input], { type: "image/png" }),
          { imageOrientation: "from-image" });
        try { return { header, native: [bitmap.width, bitmap.height] }; }
        finally { bitmap.close(); }
      }, [...bytes]);

      const clean = await test(plain);
      assert.deepEqual(clean, { header: { mime: "image/png", width: 6, height: 4 }, native: [6, 4] });
      const valid = await test(singleOrientation);
      assert.deepEqual(valid, { header: { mime: "image/png", width: 4, height: 6 }, native: [4, 6] });
      const unknown = await test(singleUnknownTag);
      assert.deepEqual(unknown, { header: { mime: "image/png", width: 6, height: 4 }, native: [6, 4] });

      const duplicateUnknown = await test(unknownThenSix);
      assert.deepEqual(duplicateUnknown.native, [6, 4],
        `${name}: native decoder ignores second orientation when first valid TIFF eXIf lacks tag`);
      assert.match(duplicateUnknown.header, /CORRUPT_IMAGE.*(?:duplicate|eXIf)/iu,
        `${name}: parser must refuse *any* second eXIf before IDAT`);

      const duplicateMalformed = await test(malformedThenSix);
      assert.match(duplicateMalformed.header, /CORRUPT_IMAGE.*(?:duplicate|eXIf)/iu,
        `${name}: malformed first eXIf does not authorize trusting a second chunk`);
      const duplicateEqual = await test(sameOrientationTwice);
      assert.match(duplicateEqual.header, /CORRUPT_IMAGE.*(?:duplicate|eXIf)/iu,
        `${name}: duplicate same-orientation chunks violate PNG single-eXIf rule`);
      assert.deepEqual(offsite, [], `${name}: offsite requests`);
      assert.deepEqual(errors, [], `${name}: browser errors`);
      console.log(`#367 ${name} PASS: three genuine single-PNG controls and all duplicate eXIf cases refused`);
      await page.close();
    } catch (error) {
      failures++;
      console.error(`#367 ${name} FAIL: ${error.stack}`);
    } finally { await browser.close(); }
  }
} finally {
  await new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
}
assert.equal(failures, 0, "#367 duplicate eXIf browser differential");
