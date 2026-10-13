/** #367: Browser-native PNG eXIf display dimensions vs local preflight and Sharp/libvips. */
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
    sourcefile: "png-exif-367-actual.ts",
  },
  write: false, bundle: true, format: "iife", platform: "browser", target: "es2022",
});
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src blob:; connect-src 'none'; object-src 'none'");
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end('<!doctype html><meta charset="utf-8"><script src="/test.js"></script>');
  }
  if (req.url === "/test.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    return res.end(outputFiles[0].text);
  }
  res.writeHead(404).end();
});
await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
const origin = `http://127.0.0.1:${server.address().port}`;

const width = 6, height = 4;
const rgb = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  rgb.set(x < 3 ? (y < 2 ? [255, 0, 0] : [0, 255, 0]) : (y < 2 ? [0, 0, 255] : [255, 255, 0]),
    (y * width + x) * 3);
}
const png = await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer();
const samples = [];
for (const orientation of [1, 3, 5, 6, 7, 8]) {
  const source = await sharp(png).withMetadata({ orientation }).png().toBuffer();
  const meta = await sharp(source).metadata();
  assert.equal(meta.orientation, orientation, "Sharp must retain eXIf orientation");
  const expected = await sharp(source).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  samples.push({ label: `PNG eXIf ${orientation}`, source, expected });
}
samples.push({
  label: "plain PNG without eXIf", source: png,
  expected: await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
});

function chunks(bytes) {
  let offset = 8;
  const found = [];
  while (offset + 12 <= bytes.length) {
    const len = bytes.readUInt32BE(offset);
    assert(offset + 12 + len <= bytes.length);
    found.push({ type: bytes.toString("ascii", offset + 4, offset + 8), bytes: bytes.subarray(offset, offset + 12 + len) });
    offset += 12 + len;
  }
  assert.equal(offset, bytes.length);
  return found;
}
function pngChunk(type, body) {
  const result = Buffer.alloc(body.length + 12);
  result.writeUInt32BE(body.length, 0);
  result.write(type, 4, 4, "ascii");
  body.copy(result, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, result.length - 4)) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
const exif6 = samples.find(x => x.label === "PNG eXIf 6").source;
const exif8 = samples.find(x => x.label === "PNG eXIf 8").source;
const chunk6 = chunks(exif6);
// TIFF IFD0, Motorola (big endian), one SHORT tag 0x0112=6. CRC is real PNG CRC32.
const tiffBig = Buffer.from("4d4d002a00000008000101120003000000010006000000000000", "hex");
const bigEndian = Buffer.concat([
  exif6.subarray(0, 8),
  ...chunk6.map(c => c.type === "eXIf" ? pngChunk("eXIf", tiffBig) : c.bytes),
]);
assert.equal((await sharp(bigEndian).metadata()).orientation, 6, "libvips recognizes big-endian eXIf");
samples.push({
  label: "PNG eXIf 6 big-endian TIFF", source: bigEndian,
  expected: await sharp(bigEndian).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true }),
});
const afterIdat = Buffer.concat([
  exif6.subarray(0, 8),
  ...chunk6.filter(c => c.type !== "eXIf" && c.type !== "IEND").map(c => c.bytes),
  chunk6.find(c => c.type === "eXIf").bytes,
  chunk6.find(c => c.type === "IEND").bytes,
]);
assert.equal((await sharp(afterIdat).metadata()).orientation, undefined, "Late eXIf is ignored by libvips");
samples.push({
  label: "PNG eXIf placed after IDAT (ignored by decoders)", source: afterIdat,
  expected: await sharp(afterIdat).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
});
const conflicting = Buffer.concat([
  exif6.subarray(0, 8),
  ...chunk6.flatMap(c => c.type === "eXIf"
    ? [c.bytes, chunks(exif8).find(x => x.type === "eXIf").bytes] : [c.bytes]),
]);
const invalidCrc = Buffer.from(exif6);
const exifOffset = invalidCrc.indexOf(Buffer.from("eXIf")) - 4;
assert(exifOffset >= 8);
const exifCrcOffset = exifOffset + 8 + invalidCrc.readUInt32BE(exifOffset);
invalidCrc[exifCrcOffset] ^= 0xff;
const truncatedMetadata = Buffer.from(exif6.subarray(0, exifOffset + 8 + 3));

let failures = 0;
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const offsite = [], errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", route => {
        if (route.request().method() === "GET" && route.request().url().startsWith(origin + "/")) return route.continue();
        offsite.push(route.request().url());
        return route.abort();
      });
      assert.equal((await page.goto(origin))?.status(), 200);
      for (const { label, source, expected } of samples) {
        const actual = await page.evaluate(async values => {
          const input = new Uint8Array(values);
          const header = window.inspect367(input);
          const bitmap = await createImageBitmap(new Blob([input], { type: "image/png" }), { imageOrientation: "from-image" });
          try {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(bitmap, 0, 0);
            return { header, width: bitmap.width, height: bitmap.height,
              rgb: [...ctx.getImageData(0, 0, bitmap.width, bitmap.height).data].filter((_, i) => i % 4 !== 3) };
          } finally { bitmap.close(); }
        }, [...source]);
        assert.deepEqual([actual.width, actual.height], [expected.info.width, expected.info.height],
          `${name} ${label}: independent Sharp vs browser dimensions`);
        assert.deepEqual(actual.header, { mime: "image/png", width: actual.width, height: actual.height },
          `${name} ${label}: parser geometry differs from browser native canvas`);
        const delta = actual.rgb.reduce((acc, value, idx) => acc + Math.abs(value - expected.data[idx]), 0) / actual.rgb.length;
        assert(delta < 4, `${name} ${label}: Sharp vs browser pixel layout differs: ${delta}`);
      }
      const rejected = await page.evaluate(values => {
        try { return window.inspect367(new Uint8Array(values)); }
        catch (error) { return String(error); }
      }, [...conflicting]);
      assert.match(rejected, /CORRUPT_IMAGE.*conflicting/u, `${name}: contradictory eXIf orientation refused`);
      const badCrc = await page.evaluate(async values => {
        const source = new Uint8Array(values);
        let refusal;
        try { refusal = window.inspect367(source); }
        catch (error) { refusal = String(error); }
        const bitmap = await createImageBitmap(new Blob([source], { type: "image/png" }));
        try { return { refusal, dimensions: [bitmap.width, bitmap.height] }; }
        finally { bitmap.close(); }
      }, [...invalidCrc]);
      assert.deepEqual(badCrc.dimensions, [width, height], `${name}: native PNG ignored invalid eXIf CRC`);
      assert.match(badCrc.refusal, /CORRUPT_IMAGE.*eXIf CRC/u,
        `${name}: invalid eXIf CRC must not override native decoder geometry`);
      const truncated = await page.evaluate(values => {
        try { return window.inspect367(new Uint8Array(values)); }
        catch (error) { return String(error); }
      }, [...truncatedMetadata]);
      assert.match(truncated, /TRUNCATED_IMAGE.*eXIf/u,
        `${name}: partial PNG eXIf before IDAT cannot be trusted`);
      assert.deepEqual(offsite, [], `${name}: external request`);
      assert.deepEqual(errors, [], `${name}: JS error`);
      console.log(`#367 ${name} PASS: ${samples.length} PNG real decodes + conflicting orientation refused`);
      await page.close();
    } catch (error) {
      failures++;
      console.error(`#367 ${name} FAIL: ${error.stack}`);
    } finally { await browser.close(); }
  }
} finally {
  await new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
}
assert.equal(failures, 0, "#367 PNG EXIF browser parity");
