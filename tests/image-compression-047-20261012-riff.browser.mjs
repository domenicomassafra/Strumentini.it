/** #047: real browser output, complete WebP framing, independent libvips reopen.
 * Run: node tests/image-compression-047-20261012-riff.browser.mjs
 * Isolated adapter proof only; no public route or physical-device acceptance.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import sharp from "sharp";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const { outputFiles } = await build({
  stdin: { contents: `import { compressImageWithDonor47 } from "./src/engines/image/compression-donor-047.ts";
    window.compress47 = compressImageWithDonor47;`, loader: "ts", resolveDir: root },
  bundle: true, platform: "browser", format: "iife", target: "es2022", write: false,
});
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src blob:; connect-src 'none'; object-src 'none'; base-uri 'none'");
  if (req.url === "/") return res.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><meta charset="utf-8"><script src="/fixture.js"></script>');
  if (req.url === "/fixture.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(outputFiles[0].text);
  res.writeHead(404).end();
});
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const origin = `http://127.0.0.1:${server.address().port}`;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

// Independent test-side RIFF framing check, separate from production inventory.
function assertCompleteRiff(bytes) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
  let at = 12;
  while (at < bytes.length) {
    assert(at + 8 <= bytes.length, "Incomplete RIFF chunk header");
    const size = bytes.readUInt32LE(at + 4);
    assert(at + 8 + size + (size & 1) <= bytes.length, "Missing RIFF payload/padding");
    if (size & 1) assert.equal(bytes[at + 8 + size], 0);
    at += 8 + size + (size & 1);
  }
  assert.equal(at, bytes.length);
}
function withTail(source, tail) {
  const bytes = Buffer.concat([source, tail]);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  return bytes;
}

const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
const source = await sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).webp({ quality: 65 }).toBuffer();
assert.equal(source.toString("ascii", 12, 16), "VP8 ");
assertCompleteRiff(source);
const originalPixels = await sharp(source).ensureAlpha().raw().toBuffer();
const oddChunk = Buffer.from([0x4a, 0x55, 0x4e, 0x4b, 1, 0, 0, 0, 42, 0]);
const validUnknown = withTail(source, oddChunk);
assertCompleteRiff(validUnknown);
const malformed = [
  ["nonzero odd-chunk padding", withTail(source, Buffer.from([0x4a, 0x55, 0x4e, 0x4b, 1, 0, 0, 0, 42, 99]))],
  ["incomplete trailing chunk header", withTail(source, Buffer.from([0, 0]))],
  ["missing odd-chunk padding", withTail(source, oddChunk.subarray(0, 9))],
  ["truncated chunk payload", withTail(source, Buffer.from([0x4a, 0x55, 0x4e, 0x4b, 4, 0, 0, 0, 42, 0]))],
];
for (const [label, bytes] of malformed) {
  assert.throws(() => assertCompleteRiff(bytes), undefined, label);
  // Record independent libwebp rejection, or prove any permissive decode still
  // has the source pixels; decoding alone cannot certify complete RIFF bytes.
  let opened;
  try { opened = await sharp(bytes).ensureAlpha().raw().toBuffer(); }
  catch (e) { assert.match(e.message, /corrupt header|unable to parse/u); }
  if (opened) assert.deepEqual(opened, originalPixels, label);
  console.log(`Independent libvips ${label}: ${opened ? "permissive pixel decode" : "REFUSED malformed WebP"}`);
}

try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const network = [], errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", route => {
        if (route.request().method() === "GET" && route.request().url().startsWith(origin + "/")) return route.continue();
        network.push(route.request().url());
        return route.abort();
      });
      await page.goto(origin);
      const compress = bytes => page.evaluate(async input => {
        try {
          const result = await window.compress47(new Blob([Uint8Array.from(input)], { type: "image/webp" }), { mode: "webp-lossy", qualityHint: 0.85 });
          return { bytes: [...new Uint8Array(await result.blob.arrayBuffer())], keptOriginal: result.keptOriginal,
            originalBytes: result.originalBytes, outputBytes: result.outputBytes, savedBytes: result.savedBytes,
            savedPercent: result.savedPercent, width: result.width, height: result.height };
        } catch (e) { return { error: String(e) }; }
      }, [...bytes]);
      for (const [label, bytes] of malformed) {
        const result = await compress(bytes);
        assert.match(result.error ?? "", /IMAGE_DONOR_47_(INVALID_INPUT|DECODE_FAILED)/u,
          `${name}: ${label} returned ${JSON.stringify(result)} rather than refusing invalid container`);
      }
      for (const bytes of [source, validUnknown]) {
        const result = await compress(bytes);
        if (result.error) {
          assert.match(result.error, /IMAGE_DONOR_47_(OUTPUT_VERIFICATION|ENCODER_UNAVAILABLE)/u);
          console.log(`${name}: native WebP encoder unavailable, explicit refusal`);
          continue;
        }
        const saved = Buffer.from(result.bytes);
        assertCompleteRiff(saved);
        const reopened = await sharp(saved).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.equal(reopened.info.width, 2);
        assert.equal(reopened.info.height, 2);
        for (let i = 3; i < reopened.data.length; i += 4) assert.equal(reopened.data[i], originalPixels[i]);
        if (result.keptOriginal) assert.deepEqual(saved, bytes);
        assert.equal(result.width, 2);
        assert.equal(result.height, 2);
        assert.equal(result.originalBytes, bytes.length);
        assert.equal(result.outputBytes, saved.length);
        assert.equal(result.savedBytes, bytes.length - saved.length);
        assert.equal(result.savedPercent, Number((100 * result.savedBytes / bytes.length).toFixed(2)));
        console.log(`${name}: ${bytes.length} -> ${saved.length} B, keptOriginal=${result.keptOriginal}, SHA-256=${hash(saved)}`);
      }
      assert.deepEqual(network, []);
      assert.deepEqual(errors, []);
      console.log(`PASS #047 ${name}: four malformed WebP containers refused, valid VP8/unknown-chunk controls independently checked`);
    } finally { await browser.close(); }
  }
} finally { await new Promise((ok, fail) => server.close(e => e ? fail(e) : ok())); }
