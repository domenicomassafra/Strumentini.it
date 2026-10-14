/** #047/#367: a permissive browser decode is not proof of a valid WebP container.
 * Run: node tests/image-compression-047-20261014-duplicate-vp8.browser.mjs
 * Exercises the exact browser adapter, without public-route or mobile claims.
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
    contents: 'import { compressImageWithDonor47 } from "./src/engines/image/compression-donor-047.ts"; window.compress47 = compressImageWithDonor47;',
    loader: "ts", resolveDir: root,
  },
  bundle: true, platform: "browser", format: "iife", target: "es2022", write: false,
});
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src blob:; connect-src 'none'; object-src 'none'; base-uri 'none'");
  if (req.url === "/") return res.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><script src="/adapter.js"></script>');
  if (req.url === "/adapter.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(outputFiles[0].text);
  res.writeHead(404).end();
});
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const origin = `http://127.0.0.1:${server.address().port}`;

function chunkNames(source) {
  assert.equal(source.toString("ascii", 0, 4), "RIFF");
  assert.equal(source.toString("ascii", 8, 12), "WEBP");
  assert.equal(source.readUInt32LE(4) + 8, source.length);
  let at = 12;
  const names = [];
  while (at < source.length) {
    assert(at + 8 <= source.length);
    const size = source.readUInt32LE(at + 4);
    assert(at + 8 + size + (size & 1) <= source.length);
    names.push(source.toString("ascii", at, at + 4));
    at += 8 + size + (size & 1);
  }
  assert.equal(at, source.length);
  return names;
}
function appendChunk(source, additional) {
  const joined = Buffer.concat([source, additional]);
  joined.writeUInt32LE(joined.length - 8, 4);
  return joined;
}
const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
const source = await sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).webp({ quality: 65 }).toBuffer();
const sourceLossless = await sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).webp({ lossless: true }).toBuffer();
assert.deepEqual(chunkNames(source), ["VP8 "]);
assert.deepEqual(chunkNames(sourceLossless), ["VP8L"]);
const duplicate = appendChunk(source, source.subarray(12));
const conflicting = appendChunk(source, sourceLossless.subarray(12));
assert.deepEqual(chunkNames(duplicate), ["VP8 ", "VP8 "]);
assert.deepEqual(chunkNames(conflicting), ["VP8 ", "VP8L"]);
const expected = await sharp(source).ensureAlpha().raw().toBuffer();
// Independent image decoders may accept these illegal bitstream combinations.
for (const malformed of [duplicate, conflicting]) {
  try { assert.deepEqual(await sharp(malformed).ensureAlpha().raw().toBuffer(), expected); }
  catch (err) { if (err instanceof assert.AssertionError) throw err; }
}

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
      await page.goto(origin);
      const compress = bytes => page.evaluate(async sourceBytes => {
        const blob = new Blob([Uint8Array.from(sourceBytes)], { type: "image/webp" });
        let decoded = false;
        try { const bitmap = await createImageBitmap(blob); decoded = bitmap.width === 2 && bitmap.height === 2; bitmap.close(); }
        catch { /* Native decoder may refuse, adapter must refuse regardless. */ }
        try {
          const output = await window.compress47(blob, { mode: "webp-lossy", qualityHint: 0.85 });
          return { decoded, keptOriginal: output.keptOriginal, output: [...new Uint8Array(await output.blob.arrayBuffer())] };
        } catch (error) { return { decoded, error: String(error) }; }
      }, [...bytes]);
      for (const [label, malformed] of [["second VP8 image", duplicate], ["VP8L after VP8", conflicting]]) {
        const result = await compress(malformed);
        assert.match(result.error ?? "", /IMAGE_DONOR_47_INVALID_INPUT/u,
          `${name}: ${label}: adapter accepted duplicate coded image: ${JSON.stringify(result)}`);
      }
      const control = await compress(source);
      if (control.error) {
        assert.match(control.error, /IMAGE_DONOR_47_(OUTPUT_VERIFICATION|ENCODER_UNAVAILABLE)/u);
      } else {
        const output = Buffer.from(control.output);
        assert.deepEqual(chunkNames(output), ["VP8 "]);
        assert.deepEqual(await sharp(output).ensureAlpha().raw().toBuffer().then(Buffer.from), expected);
      }
      assert.deepEqual(offsite, [], `${name}: no offsite/upload requests`);
      assert.deepEqual(errors, [], `${name}: no page errors`);
      console.log(`PASS #047/#367 ${name}: both duplicated WebP bitstreams refused; valid VP8 reopens or encoder explicitly refuses`);
    } finally { await browser.close(); }
  }
} finally { await new Promise((ok, fail) => server.close(e => e ? fail(e) : ok())); }
