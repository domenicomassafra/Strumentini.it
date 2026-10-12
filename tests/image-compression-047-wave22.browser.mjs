/** #047 wave22: real WebP source subtype vs actual lossy output and signed bytes.
 * Uses actual adapter bundled for browser, native encoding/decoding and
 * independent Sharp/libvips pixel + bitstream verification; no external calls.
 * Run: node tests/image-compression-047-wave22.browser.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import sharp from "sharp";
import { chromium, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const { outputFiles } = await build({
  stdin: {
    contents: `import { compressImageWithDonor47 } from "./src/engines/image/compression-donor-047.ts";
      window.compress47 = compressImageWithDonor47;`,
    sourcefile: "compression-047-fixture.ts", loader: "ts", resolveDir: root,
  },
  bundle: true, platform: "browser", format: "iife", target: "es2022", write: false,
});
const script = outputFiles[0].text;
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'none'; script-src 'self'; img-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'");
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end('<!doctype html><html><meta charset="utf-8"><script src="/fixture.js"></script></html>');
  }
  if (req.url === "/fixture.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    return res.end(script);
  }
  res.writeHead(404).end();
});
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const origin = `http://127.0.0.1:${server.address().port}`;
const sha256 = data => createHash("sha256").update(data).digest("hex");
const rgb = Buffer.from([
  255, 0, 0,   0, 255, 0,
  0, 0, 255,   255, 255, 255,
]);
const original = await sharp(rgb, { raw: { width: 2, height: 2, channels: 3 } })
  .webp({ lossless: true }).toBuffer();
assert.equal(original.toString("ascii", 12, 16), "VP8L", "Fixture must be a genuine WebP LOSSLESS bitstream");
const originalDecoded = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
assert.deepEqual({ width: originalDecoded.info.width, height: originalDecoded.info.height }, { width: 2, height: 2 });
const lossyOriginal = await sharp(rgb, { raw: { width: 2, height: 2, channels: 3 } })
  .webp({ quality: 65, effort: 4 }).toBuffer();
assert.equal(lossyOriginal.toString("ascii", 12, 16), "VP8 ", "Control source must already be genuine WebP lossy VP8");

function subtype(bytes) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF", "Missing RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP", "Missing WEBP");
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, "WebP container size mismatch");
  const names = [];
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(at + 4);
    assert(size <= bytes.length - at - 8, "Truncated RIFF chunk");
    names.push(bytes.toString("ascii", at, at + 4));
    at += 8 + size + (size & 1);
    assert(at <= bytes.length, "Unbounded RIFF chunk");
  }
  return names;
}

try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const badNetwork = [], pageErrors = [];
      page.on("pageerror", e => pageErrors.push(e.message));
      await page.route("**/*", route => {
        const request = route.request();
        if (request.method() === "GET" && request.url().startsWith(origin + "/")) return route.continue();
        badNetwork.push(`${request.method()} ${request.url()}`);
        return route.abort();
      });
      assert.equal((await page.goto(origin))?.status(), 200);
      const result = await page.evaluate(async bytes => {
        try {
          const input = new Blob([Uint8Array.from(bytes)], { type: "image/webp" });
          const output = await window.compress47(input, { mode: "webp-lossy", qualityHint: 0.85 });
          const decoded = await createImageBitmap(output.blob);
          let nativePixels;
          try {
            const canvas = document.createElement("canvas");
            canvas.width = decoded.width; canvas.height = decoded.height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(decoded, 0, 0);
            nativePixels = [...context.getImageData(0, 0, canvas.width, canvas.height).data];
          } finally { decoded.close(); }
          return {
            bytes: [...new Uint8Array(await output.blob.arrayBuffer())],
            nativePixels,
            mime: output.blob.type, mode: output.mode,
            inputMime: output.inputMime, outputMime: output.outputMime,
            width: output.width, height: output.height,
            originalBytes: output.originalBytes, outputBytes: output.outputBytes,
            savedBytes: output.savedBytes, savedPercent: output.savedPercent,
            keptOriginal: output.keptOriginal, codec: output.codec,
          };
        } catch (error) { return { error: String(error) }; }
      }, [...original]);

      if ("error" in result) {
        assert.match(result.error, /IMAGE_DONOR_47_(OUTPUT_VERIFICATION|ENCODER_UNAVAILABLE)/u,
          `${name}: unsupported WebP encoder must explicitly refuse`);
        console.log(`#047 ${name} WebP lossy unsupported: explicit browser refusal`);
      } else {
        const saved = Buffer.from(result.bytes);
        const chunks = subtype(saved);
        assert.equal(result.mode, "webp-lossy");
        assert.equal(result.mime, "image/webp");
        assert.equal(result.inputMime, "image/webp");
        assert.equal(result.outputMime, "image/webp");
        assert.deepEqual({ width: result.width, height: result.height }, { width: 2, height: 2 });
        assert(chunks.includes("VP8 "), `${name}: advertised lossy WebP returned a non-VP8 image: ${chunks.join(", ")}`);
        assert(!chunks.includes("VP8L"), `${name}: lossless source was reused while claiming lossy mode`);
        assert.equal(result.keptOriginal, false, `${name}: cannot keep lossless original for requested VP8 lossy`);
        assert.equal(result.originalBytes, original.length);
        assert.equal(result.outputBytes, saved.length);
        assert.equal(result.savedBytes, original.length - saved.length, "Savings must be signed real bytes");
        assert.equal(result.savedPercent, Number((100 * (original.length - saved.length) / original.length).toFixed(2)));
        const decoded = await sharp(saved).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.deepEqual({ width: decoded.info.width, height: decoded.info.height }, { width: 2, height: 2 });
        assert.equal(result.nativePixels.length, decoded.data.length, "Browser and independent decoder pixel buffers must agree");
        for (let i = 3; i < decoded.data.length; i += 4) {
          assert.equal(decoded.data[i], originalDecoded.data[i], `${name}: alpha damaged at pixel ${i / 4}`);
        }
        const rgbDifferences = [...decoded.data].filter((_, i) => i % 4 !== 3).map((value, i) => {
          const pixel = Math.floor(i / 3);
          return Math.abs(value - result.nativePixels[pixel * 4 + i % 3]);
        });
        const meanDifference = rgbDifferences.reduce((sum, value) => sum + value, 0) / rgbDifferences.length;
        assert(meanDifference <= 16, `${name}: native-vs-Sharp RGB mismatch ${meanDifference.toFixed(2)}`);
        assert.notEqual(sha256(saved), sha256(original), "A genuine lossy-mode output cannot be identical VP8L bytes");
        console.log(`#047 ${name} PASS WebP VP8 lossy output ${saved.length} B, source VP8L ${original.length} B, signed savings ${result.savedBytes}, Sharp alpha + source/output SHA-256`);

        // A *genuinely lossy* WebP source may still be kept when the native
        // encoder would grow it; only the wrong VP8L subtype must be excluded.
        const control = await page.evaluate(async bytes => {
          const source = new Blob([Uint8Array.from(bytes)], { type: "image/webp" });
          const value = await window.compress47(source, { mode: "webp-lossy", qualityHint: 0.85 });
          return { keptOriginal: value.keptOriginal, bytes: [...new Uint8Array(await value.blob.arrayBuffer())],
            originalBytes: value.originalBytes, outputBytes: value.outputBytes, savedBytes: value.savedBytes };
        }, [...lossyOriginal]);
        if (control.keptOriginal) {
          assert.deepEqual(Buffer.from(control.bytes), lossyOriginal, "Already-VP8 source should remain byte exact");
          assert.equal(control.originalBytes, lossyOriginal.length);
          assert.equal(control.outputBytes, lossyOriginal.length);
          assert.equal(control.savedBytes, 0);
        } else {
          assert(subtype(Buffer.from(control.bytes)).includes("VP8 "), "Control output must still be VP8");
          assert.equal(control.savedBytes, lossyOriginal.length - control.outputBytes);
        }
      }
      assert.deepEqual(pageErrors, [], `${name}: unexpected JS errors`);
      assert.deepEqual(badNetwork, [], `${name}: unexpected uploads/offsite requests`);
      await context.close();
    } finally { await browser.close(); }
  }
} finally {
  await new Promise((ok, fail) => server.close(err => err ? fail(err) : ok()));
}
