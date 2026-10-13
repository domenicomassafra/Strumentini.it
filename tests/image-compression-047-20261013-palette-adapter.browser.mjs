/** #047 real browser→installed donor adapter→PNG encoder→independent Sharp reopen.
 * Run: node tests/image-compression-047-20261013-palette-adapter.browser.mjs
 * No production API, network upload, source fixture substitution or Gold claim.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import sharp from "sharp";
import { chromium, firefox, webkit } from "@playwright/test";

const width = 96, height = 64;
const root = resolve(import.meta.dirname, "..");
const { outputFiles } = await build({
  stdin: { contents: `import { compressImageWithDonor47, DONOR_47_CAPABILITIES } from "./src/engines/image/compression-donor-047.ts";
    window.compress47 = compressImageWithDonor47;
    window.capabilities47 = DONOR_47_CAPABILITIES;`,
    sourcefile: "palette-donor-browser-047.ts", resolveDir: root, loader: "ts" },
  bundle: true, platform: "browser", format: "iife", target: "es2022", write: false,
});
const script = outputFiles[0].text;

async function fixture(exact) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const x = i % width, y = Math.floor(i / width);
    rgba[i * 4] = exact ? (x % 3) * 75 : (x * 17 + y * 5) & 255;
    rgba[i * 4 + 1] = exact ? (y % 3) * 70 : (x * 9 + y * 21) & 255;
    rgba[i * 4 + 2] = exact ? 22 : (x * 7 + y * 13) & 255;
    rgba[i * 4 + 3] = [0, 77, 191, 255][(x + y) % 4];
  }
  const bytes = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 0, palette: false }).toBuffer();
  assert.equal(bytes[25], 6, "Fixture is real 8-bit RGBA, not an indexed test shortcut");
  return { bytes, rgba };
}

const cases = [
  { mode: "png-palette-exact", exact: true, ...await fixture(true) },
  { mode: "png-palette-lossy", exact: false, ...await fixture(false) },
];

const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'none'; img-src 'self' blob:; object-src 'none'; base-uri 'none'");
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/codec.js"></script></html>');
  }
  if (req.url === "/codec.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    return res.end(script);
  }
  res.writeHead(404).end();
});
await new Promise((okay, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", okay); });
const origin = `http://127.0.0.1:${server.address().port}`;

let checks = 0;
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await driver.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const badNetwork = [], pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      await page.route("**/*", route => {
        if (route.request().method() === "GET" && route.request().url().startsWith(origin + "/")) return route.continue();
        badNetwork.push(`${route.request().method()} ${route.request().url()}`);
        return route.abort();
      });
      assert.equal((await page.goto(origin))?.status(), 200);
      for (const sample of cases) {
        const observed = await page.evaluate(async ({ bytes, mode }) => {
          const input = new Blob([new Uint8Array(bytes)], { type: "image/png" });
          const cap = window.capabilities47;
          const result = await window.compress47(input, { mode });
          const output = new Uint8Array(await result.blob.arrayBuffer());
          const image = await createImageBitmap(result.blob);
          let browserPixels;
          try {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(image, 0, 0);
            browserPixels = [...ctx.getImageData(0, 0, canvas.width, canvas.height).data];
          } finally { image.close(); }
          return {
            data: [...output], browserPixels,
            cap: { exact: cap.pngPaletteExact.supported, lossy: cap.pngPaletteLossy.supported },
            mode: result.mode, originalBytes: result.originalBytes, outputBytes: result.outputBytes,
            savedBytes: result.savedBytes, savedPercent: result.savedPercent,
            keptOriginal: result.keptOriginal, outputMime: result.outputMime,
            verification: result.verification, alphaPolicy: result.alphaPolicy,
            paletteColors: result.paletteColors, pixelPolicy: result.pixelPolicy,
            maxObservedChannelError: result.maxObservedChannelError, codec: result.codec,
            encoderQualityHint: result.encoderQualityHint,
          };
        }, { bytes: [...sample.bytes], mode: sample.mode });
        const output = Buffer.from(observed.data);
        const decoded = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.deepEqual(observed.cap, { exact: true, lossy: true });
        assert.equal(observed.mode, sample.mode);
        assert.equal(observed.outputMime, "image/png");
        assert.equal(observed.codec, "fflate");
        assert.equal(observed.encoderQualityHint, null);
        assert.equal(observed.alphaPolicy, "exact");
        assert.equal(observed.verification, "strict-png-reparse-and-alpha");
        assert.equal(observed.pixelPolicy, sample.exact ? "exact" : "lossy-rgb");
        assert.equal(observed.originalBytes, sample.bytes.length);
        assert.equal(observed.outputBytes, output.length);
        assert.equal(observed.savedBytes, sample.bytes.length - output.length);
        assert.equal(observed.savedPercent, Number((100 * observed.savedBytes / sample.bytes.length).toFixed(2)));
        assert.equal(observed.keptOriginal, false);
        assert(output.length < sample.bytes.length);
        assert.equal(output[25], 3, "Exported PNG is indexed with actual PLTE/tRNS, not just renamed RGBA");
        assert(observed.paletteColors > 0 && observed.paletteColors <= 256);
        assert(observed.maxObservedChannelError <= (sample.exact ? 0 : 32));
        assert.deepEqual({ width: decoded.info.width, height: decoded.info.height }, { width, height });
        assert.equal(observed.browserPixels.length, decoded.data.length);
        for (let i = 0; i < sample.rgba.length; i++) {
          if (i % 4 === 3 || sample.exact) assert.equal(decoded.data[i], sample.rgba[i], `${name} ${sample.mode} original pixel ${i}`);
          else assert(Math.abs(decoded.data[i] - sample.rgba[i]) <= 32, `${name} ${sample.mode} RGB error pixel ${i}`);
          // Browser premultiplication may round RGB under partial alpha, but
          // both independent Sharp and native Canvas must see identical alpha.
          if (i % 4 === 3) assert.equal(observed.browserPixels[i], decoded.data[i], `${name} output decoded alpha ${i}`);
        }
        checks += 18;
        console.log(`${name} ${sample.mode} PASS ${sample.bytes.length} → ${output.length} B, indexed IHDR, independent RGBA/alpha, signed bytes`);
      }
      const refused = await page.evaluate(async bytes => {
        const input = new Blob([new Uint8Array(bytes)], { type: "image/png" });
        const failures = [];
        for (const options of [
          { mode: "png-palette-exact", qualityHint: 0.8 },
          { mode: "png-palette-lossy", signal: AbortSignal.abort() },
          { mode: "webp-lossless" },
        ]) {
          try { await window.compress47(input, options); failures.push("FAILED_OPEN"); }
          catch (error) { failures.push(error.name === "AbortError" ? "AbortError" : String(error)); }
        }
        return failures;
      }, [...cases[0].bytes]);
      assert.match(refused[0], /IMAGE_DONOR_47_INVALID_QUALITY/u);
      assert.equal(refused[1], "AbortError");
      assert.match(refused[2], /IMAGE_DONOR_47_UNSUPPORTED_MODE/u);
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(badNetwork, []);
      checks += 5;
      await page.close();
    } finally { await browser.close(); }
  }
} finally {
  await new Promise((okay, fail) => server.close(error => error ? fail(error) : okay()));
}
console.log(`PASS #047 installed PNG palette donor browser proof ${checks}/${checks}: chromium/firefox/webkit, real output byte+alpha, no offsite`);
