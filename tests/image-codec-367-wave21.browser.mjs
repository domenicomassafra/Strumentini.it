/** #367: source-bound browser JPEG EXIF orientation vs native and libvips pixels.
 * Real Chromium + WebKit, loopback-only; no server-side image processing in the app.
 * Run: node tests/image-codec-367-wave21.browser.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import sharp from "sharp";
import { chromium, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const { outputFiles } = await build({
  stdin: { contents: `import { inspectImageHeader, signatureMatches } from "./src/engines/image/format.ts";
    window.codec367 = { inspectImageHeader, signatureMatches };`,
    resolveDir: root, loader: "ts", sourcefile: "codec-367-actual.ts" },
  write: false, bundle: true, format: "iife", platform: "browser", target: "es2022",
});
const bundle = outputFiles[0].text;
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'");
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end('<!doctype html><html><meta charset="utf-8"><title>367 codec</title><script src="/codec.js"></script></html>');
  }
  if (req.url === "/codec.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    return res.end(bundle);
  }
  res.writeHead(404).end();
});
await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
const origin = `http://127.0.0.1:${server.address().port}`;
const width = 6, height = 4;
const raw = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const pos = (y * width + x) * 3;
  // Distinct pixel-color quadrants; orientation should rotate their locations.
  raw.set(x < 3
    ? y < 2 ? [250, 10, 15] : [10, 215, 25]
    : y < 2 ? [25, 35, 230] : [240, 230, 10], pos);
}
const jpeg = await sharp(raw, { raw: { width, height, channels: 3 } })
  .jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toBuffer();
const oriented = new Map();
for (const orientation of [1, 3, 5, 6, 7, 8]) {
  // Reuse exact encoded pixels; only metadata changes.
  oriented.set(orientation, await sharp(jpeg).withMetadata({ orientation }).jpeg({
    quality: 100, chromaSubsampling: "4:4:4",
  }).toBuffer());
}
function moveExifAfterSof(source) {
  let app1 = null, sofEnd = null;
  for (let at = 2; at < source.length - 4;) {
    assert.equal(source[at], 0xff, "JPEG marker boundary");
    const marker = source[at + 1];
    if (marker === 0xda) break;
    const length = source.readUInt16BE(at + 2);
    const end = at + 2 + length;
    if (marker === 0xe1 && source.subarray(at + 4, at + 10).equals(Buffer.from("Exif\0\0"))) {
      app1 = { start: at, end };
    }
    if ([0xc0, 0xc1, 0xc2].includes(marker)) sofEnd = end;
    at = end;
  }
  assert(app1 && sofEnd && app1.end <= sofEnd, "Fixture expected APP1 before SOF");
  const rest = Buffer.concat([source.subarray(0, app1.start), source.subarray(app1.end)]);
  const at = sofEnd - (app1.end - app1.start);
  return Buffer.concat([rest.subarray(0, at), source.subarray(app1.start, app1.end), rest.subarray(at)]);
}
const samples = [...oriented].map(([orientation, source]) => ({ label: `EXIF ${orientation}`, orientation, source }));
samples.push({ label: "EXIF 6 APP1-after-SOF", orientation: 6, source: moveExifAfterSof(oriented.get(6)) });
function findExifSegment(source) {
  const marker = source.indexOf(Buffer.from("Exif\0\0"));
  assert(marker >= 4 && source[marker - 4] === 0xff && source[marker - 3] === 0xe1,
    "Expected authentic JPEG Exif APP1 before the frame");
  const start = marker - 4;
  return { marker, bytes: source.subarray(start, start + 2 + source.readUInt16BE(start + 2)) };
}
const invalidIfdOffset = Buffer.from(oriented.get(6));
invalidIfdOffset.writeUInt32BE(0xfffffff0, findExifSegment(invalidIfdOffset).marker + 10);
const contradictoryExif = Buffer.concat([
  oriented.get(6).subarray(0, 2), findExifSegment(oriented.get(8)).bytes, oriented.get(6).subarray(2),
]);
const truncatedSof = Buffer.from(oriented.get(6));
const sof = truncatedSof.indexOf(Buffer.from([0xff, 0xc0]));
assert(sof > 0, "Expected source-bound JPEG baseline SOF marker");
truncatedSof.writeUInt16BE(2, sof + 2);
const rgba = Buffer.from([
  255, 30, 0, 255, 0, 255, 50, 255, 70, 0, 255, 0, 60, 30, 15, 128,
]);
const png = await sharp(rgba, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer();
const webp = await sharp(rgba, { raw: { width: 2, height: 2, channels: 4 } }).webp({ lossless: true }).toBuffer();
const avif = await sharp(raw, { raw: { width, height, channels: 3 } }).avif().toBuffer();
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="6" height="4"><rect width="6" height="4" fill="red"/></svg>');

let failures = 0;
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const network = [], pageErrors = [];
      page.on("pageerror", err => pageErrors.push(err.message));
      await page.route("**/*", route => {
        const req = route.request();
        if (req.method() === "GET" && req.url().startsWith(origin + "/")) return route.continue();
        network.push(`${req.method()} ${req.url()}`);
        return route.abort();
      });
      assert.equal((await page.goto(origin))?.status(), 200);
      for (const { label, orientation, source } of samples) {
        const metadata = await sharp(source).metadata();
        assert.equal(metadata.orientation, orientation, `${label} independent Sharp metadata mismatch`);
        const expected = await sharp(source).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const observed = await page.evaluate(async bytes => {
          const input = Uint8Array.from(bytes);
          const header = window.codec367.inspectImageHeader(input);
          const bitmap = await createImageBitmap(new Blob([input], { type: "image/jpeg" }), { imageOrientation: "from-image" });
          try {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(bitmap, 0, 0);
            return { header, width: bitmap.width, height: bitmap.height,
              pixels: [...ctx.getImageData(0, 0, bitmap.width, bitmap.height).data] };
          } finally { bitmap.close(); }
        }, [...source]);
        assert.deepEqual({ width: observed.width, height: observed.height },
          { width: expected.info.width, height: expected.info.height },
          `${name}: native orientation disagrees with independent Sharp/libvips`);
        const nativeRgb = Buffer.from(observed.pixels.filter((_, index) => index % 4 !== 3));
        assert.equal(nativeRgb.length, expected.data.length);
        const meanDelta = [...nativeRgb].reduce((sum, value, index) => sum + Math.abs(value - expected.data[index]), 0) / nativeRgb.length;
        assert(meanDelta < 14, `${name} ${label}: native pixel matrix diverges from independent rotated JPEG (mean delta ${meanDelta})`);
        assert.deepEqual(observed.header,
          { mime: "image/jpeg", width: observed.width, height: observed.height },
          `${name}: header preview dimensions mismatch *display-oriented* decoded pixel matrix for ${label}`);
      }

      const malformed = await page.evaluate(vectors => {
        return vectors.map(({ label, bytes }) => {
          try { return { label, header: window.codec367.inspectImageHeader(Uint8Array.from(bytes)) }; }
          catch (error) { return { label, code: String(error) }; }
        });
      }, [
        { label: "invalid TIFF offset", bytes: [...invalidIfdOffset] },
        { label: "conflicting APP1 orientation", bytes: [...contradictoryExif] },
        { label: "too short SOF segment", bytes: [...truncatedSof] },
      ]);
      assert.deepEqual(malformed[0]?.header, { mime: "image/jpeg", width, height },
        `${name}: invalid orientation pointer cannot swap legitimate JPEG dimensions`);
      assert.match(malformed[1]?.code ?? "", /CORRUPT_IMAGE.*conflicting Exif/u,
        `${name}: contradictory Exif tags cannot select arbitrary orientation`);
      assert.match(malformed[2]?.code ?? "", /CORRUPT_IMAGE.*SOF length/u,
        `${name}: invalid SOF segment must never supply dimensions`);

      for (const [label, bytes, expectedMime] of [["PNG-RGBA", png, "image/png"], ["WebP-lossless", webp, "image/webp"]]) {
        const expected = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const result = await page.evaluate(async ({ bytes, mime }) => {
          const source = Uint8Array.from(bytes);
          const header = window.codec367.inspectImageHeader(source);
          const bitmap = await createImageBitmap(new Blob([source], { type: mime }));
          try {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(bitmap, 0, 0);
            return { header, rgba: [...ctx.getImageData(0, 0, bitmap.width, bitmap.height).data] };
          } finally { bitmap.close(); }
        }, { bytes: [...bytes], mime: expectedMime });
        assert.deepEqual(result.header, { mime: expectedMime, width: 2, height: 2 }, `${name}: ${label} header`);
        // Canvas premultiplication may erase fully transparent hidden RGB;
        // compare exact alpha and RGB on opaque pixels only.
        for (let i = 0; i < expected.data.length; i += 4) {
          assert.equal(result.rgba[i + 3], expected.data[i + 3], `${name}: ${label} alpha pixel ${i / 4}`);
          if (expected.data[i + 3] === 255) {
            assert.deepEqual(result.rgba.slice(i, i + 3), [...expected.data.subarray(i, i + 3)],
              `${name}: ${label} fully opaque RGB pixel ${i / 4}`);
          }
        }
      }
      for (const [label, bytes] of [["AVIF", avif], ["SVG", svg], ["random", Buffer.from("not an image")]]) {
        const refused = await page.evaluate(bytes => {
          try { return { accepted: window.codec367.inspectImageHeader(Uint8Array.from(bytes)) }; }
          catch (err) { return { code: String(err) }; }
        }, [...bytes]);
        assert.match(refused.code ?? "", /UNSUPPORTED_TYPE/u, `${name}: must not falsely support ${label}`);
      }
      assert.deepEqual(network, [], `${name} unexpected external requests/uploads`);
      assert.deepEqual(pageErrors, [], `${name} JS errors`);
      console.log(`#367 ${name} PASS native JPEG EXIF pixels, PNG/WebP RGBA, unsupported AVIF/SVG refusal; SHA: jpeg=${digest(jpeg).slice(0, 12)}, png=${digest(png).slice(0, 12)}`);
      await context.close();
    } catch (error) { failures++; console.error(`#367 ${name} FAIL: ${error.message}`); }
    finally { await browser.close(); }
  }
} finally {
  await new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
}
assert.equal(failures, 0, "#367 browser engines must all pass");
