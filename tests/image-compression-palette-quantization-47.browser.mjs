/** #047 actual source in Chromium/Firefox/WebKit; no public route or promotion.
 * node tests/image-compression-palette-quantization-47.browser.mjs
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium, firefox, webkit } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const width = 80;
const height = 72;
const fixtures = [];
for (const mode of ["exact", "lossy"]) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = 4 * (y * width + x);
    if (mode === "exact") {
      const n = (x + y) % 4;
      rgba.set([n * 47, 255 - n * 51, n * 27, n % 2 ? 99 : 255], at);
    } else {
      rgba.set([(x * 7 + y * 3) & 255, (x * 3 + y * 11) & 255,
        (x * 13 + y * 5) & 255, x % 4 ? 255 : 0], at);
    }
  }
  const input = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 0, palette: false }).toBuffer();
  fixtures.push({ mode, rgba, input });
}

const vite = await createServer({
  root, configFile: false, logLevel: "error", server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "palette-047-acceptance", configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== "/__palette-047") return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end('<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body>local</body></html>');
    });
  } }],
});

let checks = 0;
try {
  await vite.listen();
  const address = vite.httpServer?.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const requests = [];
      const errors = [];
      page.on("request", (req) => requests.push({ url: req.url(), method: req.method() }));
      page.on("pageerror", (error) => errors.push(error.message));
      assert.equal((await page.goto(`${origin}/__palette-047`))?.status(), 200);
      checks++;
      for (const sample of fixtures) {
        const actual = await page.evaluate(async ({ encoded, mode }) => {
          const { quantizePngPalette47 } = await import("/src/engines/image/png-palette-lossy-47.ts");
          const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
          const output = await quantizePngPalette47(new Blob([bytes], { type: "image/png" }), { mode });
          const data = new Uint8Array(await output.blob.arrayBuffer());
          let base64 = "";
          for (let at = 0; at < data.length; at += 8192) {
            base64 += Array.from(data.subarray(at, at + 8192), (byte) => String.fromCharCode(byte)).join("");
          }
          return { encoded: btoa(base64), outputBytes: output.outputBytes,
            originalBytes: output.originalBytes, savedBytes: output.savedBytes,
            keptOriginal: output.keptOriginal, pixelPolicy: output.pixelPolicy,
            maxError: output.maxObservedChannelError, outputColorType: output.outputColorType,
            alpha: output.alphaVerification, width: output.width, height: output.height };
        }, { encoded: sample.input.toString("base64"), mode: sample.mode });
        const bytes = Buffer.from(actual.encoded, "base64");
        const info = await sharp(bytes).metadata();
        const source = await sharp(sample.input).ensureAlpha().raw().toBuffer();
        const output = await sharp(bytes).ensureAlpha().raw().toBuffer();
        assert.equal(info.isPalette, true);
        assert.equal(actual.keptOriginal, false);
        assert.equal(actual.outputColorType, 3);
        assert.equal(actual.width, width);
        assert.equal(actual.height, height);
        assert.equal(actual.originalBytes - actual.outputBytes, actual.savedBytes);
        assert.equal(actual.outputBytes, bytes.length);
        assert.equal(actual.alpha, "exact");
        assert(actual.maxError <= 32);
        assert(bytes.length < sample.input.length);
        checks += 10;
        if (sample.mode === "exact") {
          assert.equal(actual.pixelPolicy, "exact");
          assert.deepEqual(output, source);
          assert.equal(actual.maxError, 0);
          checks += 3;
        } else {
          assert.equal(actual.pixelPolicy, "lossy-rgb");
          let largestError = 0;
          for (let i = 0; i < source.length; i += 4) {
            assert.equal(output[i + 3], source[i + 3], `transparent pixel changed ${i / 4}`);
            for (let channel = 0; channel < 3; channel++) {
              largestError = Math.max(largestError, Math.abs(output[i + channel] - source[i + channel]));
            }
          }
          assert(largestError <= 32);
          assert.equal(largestError, actual.maxError);
          checks += 3;
        }
        console.log(`${engine.name()} PNG palette ${sample.mode} ${sample.input.length}→${bytes.length}B, independent Sharp pixels/alpha PASS`);
      }
      assert.deepEqual(errors, []);
      assert.equal(requests.filter((req) => req.method !== "GET").length, 0);
      assert.equal(requests.filter((req) => !req.url.startsWith(origin)).length, 0);
      checks += 3;
    } finally { await browser.close(); }
  }
  console.log(`PASS #047 palette source cross-browser: ${checks}/${checks} checks; zero offsite requests, no physical mobile/UI claim`);
} finally { await vite.close(); }
