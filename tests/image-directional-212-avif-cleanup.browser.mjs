/** #212: real Chromium must release decoded AVIF surfaces after pixel-limit refusal.
 * Run: node tests/image-directional-212-avif-cleanup.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const width = 4_001;
const height = 4_000; // Just above the 16-million-pixel guard; below the dimension guard.
const large = await sharp({ create: {
  width, height, channels: 3, background: { r: 31, g: 93, b: 137 },
} }).avif({ effort: 0, quality: 20 }).toBuffer();
const still = await readFile(resolve(root, "quality/fixtures/image-format-matrix/source.avif"));
const bundle = await build({
  stdin: {
    contents: 'import { decodePortableImage } from "./src/engines/image/portable-decode.ts"; window.decodePortable212 = decodePortableImage;',
    loader: "ts", resolveDir: root,
  }, bundle: true, platform: "browser", format: "iife", target: "es2022", write: false,
});
const server = createServer((request, response) => {
  response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src blob:; connect-src 'none'; object-src 'none'; base-uri 'none'");
  if (request.url === "/") return response.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><script src="/app.js"></script>');
  if (request.url === "/app.js") return response.writeHead(200, { "content-type": "text/javascript" }).end(bundle.outputFiles[0].text);
  response.writeHead(404).end();
});
await new Promise((resolveReady, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveReady); });
let browser;
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const unexpected = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    if (route.request().method() === "GET" && route.request().url().startsWith(origin + "/")) return route.continue();
    unexpected.push(`${route.request().method()} ${route.request().url()}`);
    return route.abort();
  });
  await page.goto(origin);
  const observed = await page.evaluate(async ({ largeBytes, stillBytes }) => {
    const native = createImageBitmap.bind(window);
    let closed = 0;
    window.createImageBitmap = async (...args) => {
      const bitmap = await native(...args); // Real Chromium AV1 image decoding.
      const originalClose = bitmap.close.bind(bitmap);
      bitmap.close = () => { closed++; originalClose(); };
      return bitmap;
    };
    const file = (data, name) => {
      const blob = new File([Uint8Array.from(data)], name, { type: "image/avif" });
      return { name, size: blob.size, type: blob.type, blob };
    };
    const oversized = file(largeBytes, "too-many-pixels.avif");
    let refusal = null;
    try { await window.decodePortable212(oversized); }
    catch (error) { refusal = String(error); }
    const closedAfterRefusal = closed;
    const valid = await window.decodePortable212(file(stillBytes, "source.avif"));
    const positive = { width: valid.width, height: valid.height, closedBeforeCaller: closed - closedAfterRefusal };
    valid.bitmap.close();
    return { refusal, closedAfterRefusal, positive, closedFinally: closed };
  }, { largeBytes: [...large], stillBytes: [...still] });
  assert.match(observed.refusal ?? "", /PIXEL_LIMIT/, "Real oversized AVIF must be rejected");
  assert.equal(observed.closedAfterRefusal, 1, "Refused AVIF must release its real decoded bitmap exactly once");
  assert.deepEqual(observed.positive, { width: 2, height: 2, closedBeforeCaller: 0 });
  assert.equal(observed.closedFinally, 2, "Caller owns and releases accepted AVIF bitmap");
  assert.deepEqual(unexpected, [], "No external network or uploads");
  assert.deepEqual(errors, [], "No uncaught page errors");
  console.log("PASS #212 Chromium: real 4001×4000 AVIF pixel-limit rejection closes ImageBitmap; still AVIF ownership preserved; strict CSP, zero offsite requests");
} finally {
  await browser?.close();
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
}
