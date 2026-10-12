/** #047 wave23: indexed PNG palette reference integrity with real browser
 * source/output PNG and independent Sharp/libvips RGBA + ICC readbacks.
 * Run: node tests/png-lossless-47-wave23.browser.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { deflateSync } from "node:zlib";
import { resolve } from "node:path";
import { build } from "esbuild";
import sharp from "sharp";
import { chromium, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const magic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length);
  head.write(name, 4, "ascii");
  const body = Buffer.concat([head, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body.subarray(4)));
  return Buffer.concat([body, crc]);
}
function scanChunks(png) {
  assert.deepEqual(png.subarray(0, 8), magic);
  const chunks = [];
  for (let at = 8; at < png.length;) {
    assert(at + 12 <= png.length, "Truncated chunk");
    const size = png.readUInt32BE(at);
    const name = png.toString("ascii", at + 4, at + 8);
    assert(at + 12 + size <= png.length, "Chunk outside file");
    const full = png.subarray(at, at + 12 + size);
    assert.equal(full.readUInt32BE(size + 8), crc32(full.subarray(4, size + 8)), `CRC ${name}`);
    chunks.push({ name, full, data: full.subarray(8, size + 8) });
    at += size + 12;
  }
  return chunks;
}
const width = 128, height = 96;
const target = Buffer.alloc(width * height * 4);
const rows = [];
const rawRows = [];
for (let y = 0; y < height; y++) {
  const packed = Buffer.alloc(width / 8);
  for (let x = 0; x < width; x++) {
    const index = ((x >> 3) + (y >> 1)) % 2;
    if (index) packed[x >> 3] |= (1 << (7 - (x & 7)));
    target.set(index === 0 ? [230, 20, 30, 255] : [20, 40, 230, 127], (y * width + x) * 4);
  }
  rawRows.push(packed);
  const filtered = Buffer.alloc(packed.length + 1);
  const filter = y % 5;
  filtered[0] = filter;
  const upper = y ? rawRows[y - 1] : Buffer.alloc(packed.length);
  for (let i = 0; i < packed.length; i++) {
    const left = i ? packed[i - 1] : 0;
    const above = upper[i];
    const upperLeft = i ? upper[i - 1] : 0;
    const p = left + above - upperLeft;
    const a = Math.abs(p - left), b = Math.abs(p - above), c = Math.abs(p - upperLeft);
    const paeth = a <= b && a <= c ? left : b <= c ? above : upperLeft;
    const predictor = [0, left, above, Math.floor((left + above) / 2), paeth][filter];
    filtered[i + 1] = (packed[i] - predictor + 256) & 255;
  }
  rows.push(filtered);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 1; // Packed 1-bit indexed colors (actual index 0 and index 1 used).
ihdr[9] = 3;
const iccCarrier = await sharp(target, { raw: { width, height, channels: 4 } })
  .withIccProfile("srgb").png({ palette: true, colours: 2 }).toBuffer();
const icc = scanChunks(iccCarrier).find(x => x.name === "iCCP");
assert(icc && icc.data.length > 200, "Pinned installed Sharp must supply an actual ICC profile");
const gamma = Buffer.alloc(4);
gamma.writeUInt32BE(45455);
const commonBefore = [
  chunk("IHDR", ihdr), chunk("gAMA", gamma), Buffer.from(icc.full),
];
const idat = chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 0 }));
const tail = chunk("IEND", Buffer.alloc(0));
const makePng = palette => Buffer.concat([
  magic, ...commonBefore, chunk("PLTE", palette),
  chunk("tRNS", Buffer.from([255, 127])), idat, tail,
]);
const fullPalette = Buffer.from([230, 20, 30, 20, 40, 230]);
const valid = makePng(fullPalette);
// A *genuinely malformed* source: one color removed, while the decoded
// raster still uses palette index 1. Keep tRNS legal by shortening it.
const invalidPalette = Buffer.concat([
  magic, ...commonBefore, chunk("PLTE", fullPalette.subarray(0, 3)),
  chunk("tRNS", Buffer.from([255])), idat, tail,
]);
function partialPalettePng(depth, missingIndex) {
  const w = 17, h = 5;
  const info = Buffer.alloc(13);
  info.writeUInt32BE(w, 0); info.writeUInt32BE(h, 4);
  info[8] = depth; info[9] = 3;
  const bytesPerRow = Math.ceil(w * depth / 8);
  const padding = bytesPerRow * 8 - w * depth;
  const scanlines = [];
  for (let y = 0; y < h; y++) {
    const samples = Buffer.alloc(bytesPerRow);
    if (padding) samples[bytesPerRow - 1] = (1 << padding) - 1;
    if (missingIndex && y === h - 1) {
      const bit = (w - 1) * depth;
      samples[bit >>> 3] |= 1 << (8 - depth - (bit & 7));
    }
    scanlines.push(Buffer.concat([Buffer.from([0]), samples]));
  }
  return Buffer.concat([magic, chunk("IHDR", info),
    chunk("PLTE", Buffer.from([230, 20, 30])),
    chunk("tRNS", Buffer.from([255])),
    chunk("IDAT", deflateSync(Buffer.concat(scanlines), { level: 0 })), tail]);
}
assert.deepEqual(scanChunks(valid).map(x => x.name), ["IHDR", "gAMA", "iCCP", "PLTE", "tRNS", "IDAT", "IEND"]);
assert.deepEqual(scanChunks(invalidPalette).map(x => x.name), ["IHDR", "gAMA", "iCCP", "PLTE", "tRNS", "IDAT", "IEND"]);
const independent = await sharp(valid).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
assert.deepEqual({ width: independent.info.width, height: independent.info.height }, { width, height });
assert.deepEqual(independent.data, target, "Independent libvips must see the exact authored palette and alpha pixels");
const originalMetadata = await sharp(valid).metadata();
assert.equal(originalMetadata.hasProfile, true);
assert.equal(originalMetadata.isPalette, true);

const { outputFiles } = await build({
  stdin: {
    contents: `import { compressPngLossless47 } from "./src/engines/image/png-lossless-47.ts";
      window.compressPng47 = compressPngLossless47;`,
    resolveDir: root, sourcefile: "png47-real-source.ts", loader: "ts",
  },
  bundle: true, platform: "browser", format: "iife", target: "es2022", write: false,
});
const js = outputFiles[0].text;
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'");
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end('<!doctype html><html><meta charset="utf-8"><script src="/app.js"></script></html>');
  }
  if (req.url === "/app.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    return res.end(js);
  }
  return res.writeHead(404).end();
});
await new Promise((ok, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", ok);
});
const origin = "http://127.0.0.1:" + server.address().port;
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const violations = [], pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      await page.route("**/*", route => {
        const request = route.request();
        if (request.method() === "GET" && request.url().startsWith(origin + "/")) return route.continue();
        violations.push(`${request.method()} ${request.url()}`);
        return route.abort();
      });
      assert.equal((await page.goto(origin))?.status(), 200);
      const compute = async png => page.evaluate(async bytes => {
        try {
          const source = new Blob([Uint8Array.from(bytes)], { type: "image/png" });
          const result = await window.compressPng47(source);
          const output = new Uint8Array(await result.blob.arrayBuffer());
          const pixelsFor = async blob => {
            const bitmap = await createImageBitmap(blob);
            try {
              const canvas = document.createElement("canvas");
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              const context = canvas.getContext("2d", { willReadFrequently: true });
              context.drawImage(bitmap, 0, 0);
              return [...context.getImageData(0, 0, canvas.width, canvas.height).data];
            } finally { bitmap.close(); }
          };
          return { bytes: [...output],
            sourcePixels: await pixelsFor(source), outputPixels: await pixelsFor(result.blob),
            savedBytes: result.savedBytes,
            originalBytes: result.originalBytes, outputBytes: result.outputBytes,
            savedPercent: result.savedPercent, keptOriginal: result.keptOriginal,
            colorType: result.colorType, bitDepth: result.bitDepth,
            hasTrnsChunk: result.hasTrnsChunk, pixelVerification: result.pixelVerification };
        } catch (error) { return { error: String(error) }; }
      }, [...png]);
      const done = await compute(valid);
      assert(!done.error, `${name} real valid ICC/gamma indexed PNG rejected: ${done.error}`);
      const compressed = Buffer.from(done.bytes);
      const metadata = await sharp(compressed).metadata();
      const decoded = await sharp(compressed).ensureAlpha().raw().toBuffer();
      assert.deepEqual(decoded, independent.data, `${name}: output must be exact source RGBA pixels`);
      assert.deepEqual(done.outputPixels, done.sourcePixels,
        `${name}: native browser decoded RGBA must be identical for source and output (ICC/gamma included)`);
      for (let i = 3; i < done.outputPixels.length; i += 4) {
        assert.equal(done.outputPixels[i], independent.data[i], `${name}: native and Sharp alpha disagree at pixel ${i / 4}`);
      }
      assert.deepEqual({ width: metadata.width, height: metadata.height, profile: metadata.hasProfile }, { width, height, profile: true });
      assert.equal(done.hasTrnsChunk, true);
      assert.equal(done.colorType, 3);
      assert.equal(done.bitDepth, 1);
      assert.equal(done.pixelVerification, "exact-filtered-scanlines");
      assert(done.bytes.length < valid.length, `${name}: deliberately level-0 source ought to recompress`);
      assert.equal(done.originalBytes, valid.length);
      assert.equal(done.outputBytes, compressed.length);
      assert.equal(done.savedBytes, valid.length - compressed.length);
      assert.equal(done.savedPercent, Number((100 * done.savedBytes / valid.length).toFixed(2)));
      const sourceChunks = scanChunks(valid).filter(x => x.name !== "IDAT");
      const outputChunks = scanChunks(compressed).filter(x => x.name !== "IDAT");
      assert.deepEqual(outputChunks.map(x => x.full), sourceChunks.map(x => x.full),
        `${name}: gAMA / ICC / tRNS / PLTE and all non-IDAT bytes must be bit-exact`);
      const invalid = await compute(invalidPalette);
      assert.match(invalid.error ?? "", /PNG_47_MALFORMED.*palette/iu,
        `${name}: decoder must not certify indexed pixels referencing missing PLTE entries`);
      for (const depth of [1, 2, 4, 8]) {
        const oneColor = partialPalettePng(depth, false);
        const onlyPadding = await compute(oneColor);
        assert(!onlyPadding.error, `${name}: valid partial PLTE indexed depth ${depth} incorrectly refused: ${onlyPadding.error}`);
        const reopened = await sharp(Buffer.from(onlyPadding.bytes)).ensureAlpha().raw().toBuffer();
        const expectedPixels = await sharp(oneColor).ensureAlpha().raw().toBuffer();
        assert.deepEqual(reopened, expectedPixels, `${name}: valid bitdepth ${depth} pixel mismatch`);
        assert.deepEqual(onlyPadding.outputPixels, onlyPadding.sourcePixels,
          `${name}: native readback depth ${depth} changed pixels`);
        const missingColor = await compute(partialPalettePng(depth, true));
        assert.match(missingColor.error ?? "", /PNG_47_MALFORMED.*palette/iu,
          `${name}: depth ${depth} indexed sample references absent PLTE entry`);
      }
      assert.deepEqual(pageErrors, [], `${name} unexpected JS errors`);
      assert.deepEqual(violations, [], `${name} unexpected uploads or offsite fetches`);
      console.log(`#047 wave23 ${name} PASS indexed/tRNS/gAMA/ICC ${valid.length}→${compressed.length}B, exact source+output RGBA, SHA256 ${sha256(compressed).slice(0,12)}, malformed missing palette reference refused`);
      await context.close();
    } finally { await browser.close(); }
  }
} finally {
  await new Promise((ok, fail) => server.close(error => error ? fail(error) : ok()));
}
