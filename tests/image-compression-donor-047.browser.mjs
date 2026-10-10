/** Isolated source-browser acceptance for installed/browser donors (#047).
 * No repository/public UI mutations. Run: node tests/image-compression-donor-047.browser.mjs
 */
import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium, firefox, webkit } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const width = 136;
const height = 94;
const rgba = Buffer.alloc(width * height * 4);
const rgb = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * width + x;
    rgba.set([(x * 17 + y * 3) & 255, (y * 23 + x * 2) & 255, (x + y * 6) & 255, (x * 7 + y * 13) & 255], i * 4);
    rgb.set([(x * 17 + y * 3) & 255, (y * 23 + x * 2) & 255, (x + y * 6) & 255], i * 3);
  }
}
const jpegOriginal = await sharp(rgb, { raw: { width, height, channels: 3 } }).jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toBuffer();
const pngOriginal = await sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 0, palette: false }).toBuffer();
const pngRgb = await sharp(rgb, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 0, palette: false }).toBuffer();
const samples = [
  { label: "JPEG-normal", mode: "jpeg-normal", input: jpegOriginal, mime: "image/jpeg", expected: "image/jpeg", alpha: false },
  { label: "JPEG-compact", mode: "jpeg-compact", input: jpegOriginal, mime: "image/jpeg", expected: "image/jpeg", alpha: false },
  { label: "WebP-transparent", mode: "webp-lossy", input: pngOriginal, mime: "image/png", expected: "image/webp", alpha: true },
  { label: "PNG-pixels", mode: "png-lossless", input: pngRgb, mime: "image/png", expected: "image/png", alpha: false },
];

const vite = await createServer({
  root, configFile: false, logLevel: "error", server: { host: "127.0.0.1", port: 0, strictPort: false },
  plugins: [{ name: "image-donor-047-acceptance", configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== "/__image-donor-047") return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end('<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>Local image donor #047</body></html>');
    });
  } }],
});

let checks = 0;
try {
  await vite.listen();
  const addr = vite.httpServer?.address();
  assert(addr && typeof addr !== "string");
  const origin = `http://127.0.0.1:${addr.port}`;
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const requests = [];
      const errors = [];
      page.on("request", (req) => requests.push({ url: req.url(), method: req.method(), data: req.postData() }));
      page.on("pageerror", (e) => errors.push(e.message));
      assert.equal((await page.goto(`${origin}/__image-donor-047`))?.status(), 200);
      for (const sample of samples) {
        const actual = await page.evaluate(async ({ encoded, mime, mode }) => {
          const { compressImageWithDonor47 } = await import("/src/engines/image/compression-donor-047.ts");
          const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
          const source = new Blob([bytes], { type: mime });
          let result;
          try { result = await compressImageWithDonor47(source, { mode }); }
          catch (error) { return { refused: String(error) }; }
          const output = new Uint8Array(await result.blob.arrayBuffer());
          return { output: btoa(Array.from(output, (byte) => String.fromCharCode(byte)).join("")),
            outputMime: result.outputMime, inputMime: result.inputMime, mode: result.mode,
            originalBytes: result.originalBytes, outputBytes: result.outputBytes,
            savedBytes: result.savedBytes, keptOriginal: result.keptOriginal,
            verification: result.verification, alphaPolicy: result.alphaPolicy,
            qualityHint: result.encoderQualityHint, width: result.width, height: result.height };
        }, { encoded: sample.input.toString("base64"), mime: sample.mime, mode: sample.mode });
        if (actual.refused) {
          // WebKit's Canvas toBlob('image/webp') may silently return PNG. It is
          // correct to REFUSE rather than falsely report WebP support.
          assert.equal(engine.name(), "webkit");
          assert.equal(sample.mode, "webp-lossy");
          assert.match(actual.refused, /IMAGE_DONOR_47_OUTPUT_VERIFICATION/u);
          checks += 10;
          console.log(`${engine.name()} ${sample.label}: unsupported browser encoder correctly refused (no WebP mislabel)`);
          continue;
        }
        const output = Buffer.from(actual.output, "base64");
        const reopened = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const original = await sharp(sample.input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.equal(actual.outputMime, sample.expected);
        assert.equal(reopened.info.width, width);
        assert.equal(reopened.info.height, height);
        assert.equal(actual.originalBytes - actual.outputBytes, actual.savedBytes);
        assert.equal(actual.outputBytes, output.length);
        assert.equal(actual.mode, sample.mode);
        assert.equal(reopened.data.length, original.data.length);
        // External Sharp/libvips verifies exact alpha independently of browser Canvas.
        for (let i = 3; i < reopened.data.length; i += 4) assert.equal(reopened.data[i], original.data[i], `alpha index=${i} engine=${engine.name()} mode=${sample.mode}`);
        if (sample.mode === "png-lossless") {
          assert.deepEqual(reopened.data, original.data);
          assert.equal(actual.verification, "exact-filtered-scanlines");
        } else {
          assert.equal(actual.verification, "independent-browser-redecode-and-alpha");
          const delta = reopened.data.reduce((sum, v, i) => sum + (i % 4 === 3 ? 0 : Math.abs(v - original.data[i])), 0);
          const mean = delta / (width * height * 3);
          assert(mean < 30, `${engine.name()} ${sample.mode} delta too high: ${mean.toFixed(2)}`);
        }
        if (sample.mode === "jpeg-compact") assert(actual.outputBytes <= sample.input.length);
        if (sample.mode === "webp-lossy") {
          assert.equal(output.toString("ascii", 0, 4), "RIFF");
          assert.equal(output.toString("ascii", 8, 12), "WEBP");
          assert.equal(actual.alphaPolicy, "exact");
        }
        checks += 10;
        console.log(`${engine.name()} ${sample.label}: ${sample.input.length} → ${output.length} bytes, alpha-safe Sharp reopen PASS`);
      }
      const failure = await page.evaluate(async ({ encoded }) => {
        const { compressImageWithDonor47 } = await import("/src/engines/image/compression-donor-047.ts");
        const input = new Blob([Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))], { type: "image/png" });
        let rejected = false;
        try { await compressImageWithDonor47(input, { mode: "jpeg-normal" }); }
        catch (e) { rejected = String(e).includes("IMAGE_DONOR_47_ALPHA_UNSUPPORTED"); }
        return rejected;
      }, { encoded: pngOriginal.toString("base64") });
      assert.equal(failure, true);
      assert.deepEqual(errors, []);
      assert.equal(requests.filter((item) => item.method !== "GET").length, 0);
      assert.equal(requests.filter((item) => !item.url.startsWith(origin)).length, 0);
      assert.equal(requests.filter((item) => /JFIF|RIFF|Rossi|data:image/iu.test(item.url + (item.data ?? ""))).length, 0);
      checks += 5;
    } finally { await browser.close(); }
  }
  console.log(`PASS #047 donor actual browser+Sharp acceptance ${checks}/${checks}; no network uploads, no mobile hardware claimed`);
} finally { await vite.close(); }
