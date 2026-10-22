/** Acceptance on the compiled /tools/image-crop/ island. Prerequisite: npm run build. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, relative, extname, sep } from "node:path";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const html = await readFile(resolve(root, "tools/image-crop/index.html"), "utf8");
assert.match(html, /image-crop/u, "Compiled image editor route must exist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
const missingResources = [];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = resolve(root, "." + decodeURIComponent(url.pathname), url.pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(root, path);
    if (rel === ".." || rel.startsWith(".." + sep) || path === root) return res.writeHead(403).end();
    const data = await readFile(path);
    res.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    missingResources.push(req.url);
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
});
await new Promise((accept, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", accept);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const png = (width, height, r, g, b) => sharp({ create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } } }).png().toBuffer();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const uploads = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", (route) => {
    const request = route.request();
    if (request.method() !== "GET" && request.method() !== "HEAD") uploads.push(request.url());
    if (request.url().startsWith(origin + "/") || /^(?:blob|data):/u.test(request.url())) return route.continue();
    return route.abort();
  });
  await page.goto(origin + "/tools/image-crop/", { waitUntil: "domcontentloaded" });
  await page.locator("astro-island:has([data-381-open]):not([ssr])").waitFor({ timeout: 20_000 }).catch(async (cause) => {
    throw new Error(`Image editor hydration failed: ${cause.message}; browser errors: ${JSON.stringify(errors)}; missing assets: ${JSON.stringify(missingResources)}`);
  });
  await page.locator("[data-381-open]").click();
  await page.locator('[data-str-381="layers"]').waitFor({ timeout: 10_000 });
  const canvas = page.locator("[data-381-canvas]");
  const pixel = () => canvas.evaluate((node) => [...node.getContext("2d").getImageData(0, 0, 1, 1).data]);
  const assertPixel = async (expected) => {
    await page.waitForFunction((value) => {
      const node = document.querySelector("[data-381-canvas]");
      if (!node || !node.width || !node.height) return false;
      return [...node.getContext("2d").getImageData(0, 0, 1, 1).data].every((channel, index) => channel === value[index]);
    }, expected);
    assert.deepEqual(await pixel(), expected);
  };
  const files = async (width, height) => {
    const red = await png(width, height, 255, 0, 0);
    const blue = await png(width, height, 0, 0, 255);
    await page.locator("#layers-381-files").setInputFiles([
      { name: "originale-rosso.png", mimeType: "image/png", buffer: red },
      { name: "originale-blu.png", mimeType: "image/png", buffer: blue },
    ]);
    await page.locator('[data-381-layer="1"]').waitFor();
    const browserHashes = await page.locator("#layers-381-files").evaluate(async (input) => {
      const files = Array.from(input.files);
      return Promise.all(files.map(async (file) => {
        const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      }));
    });
    assert.deepEqual(browserHashes, [sha(red), sha(blue)], "Browser File bytes remain identical");
    assert.match(await page.locator("[data-381-dimensions]").innerText(), new RegExp(`${width} × ${height}`));
    return [red, blue];
  };

  // S: actual canvas alpha/color changes, order and visibility, then the exported PNG.
  const smallInputs = await files(2, 1);
  await assertPixel([0, 0, 255, 255]);
  await page.getByRole("slider", { name: "Opacità livello 2" }).evaluate((slider) => {
    slider.value = "50";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await assertPixel([128, 0, 128, 255]);
  await page.locator('[data-381-layer="1"] input[type="checkbox"]').uncheck();
  await assertPixel([255, 0, 0, 255]);
  await page.locator('[data-381-layer="1"] input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Porta dietro livello 2" }).click();
  await assertPixel([255, 0, 0, 255]);
  await page.getByRole("button", { name: "Porta avanti livello 1" }).click();
  await assertPixel([128, 0, 128, 255]);
  await page.locator("[data-381-export]").click();
  const link = page.locator('a[download="immagine-livelli.png"]');
  await link.waitFor();
  const downloadEvent = page.waitForEvent("download");
  await link.click();
  const download = await downloadEvent;
  const output = await sharp(await readFile(await download.path())).raw().toBuffer({ resolveWithObject: true });
  assert.equal(output.info.width, 2);
  assert.equal(output.info.height, 1);
  assert.deepEqual([...output.data.subarray(0, 4)], [128, 0, 128, 255], "Export PNG equals the actual canvas pixel oracle");
  const originalHashesAfter = await page.locator("#layers-381-files").evaluate(async (input) => Promise.all(Array.from(input.files).map(async (file) => {
    const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  })));
  assert.deepEqual(originalHashesAfter, smallInputs.map(sha), "Input files unchanged after edits and export");

  // M/L: same real route, decode and canvas composition without network egress.
  for (const side of [128, 1024]) {
    await files(side, side);
    await assertPixel([0, 0, 255, 255]);
    assert.equal(await canvas.evaluate((node) => node.width), side);
    assert.equal(await canvas.evaluate((node) => node.height), side);
    assert.equal(await canvas.evaluate((node) => node.getBoundingClientRect().width <= innerWidth), true);
  }
  // A compressed large PNG is rejected from its header before browser bitmap decoding.
  const giant = await png(1500, 1500, 1, 2, 3);
  await page.locator("#layers-381-files").setInputFiles([{ name: "gigante.png", mimeType: "image/png", buffer: giant }]);
  await page.getByRole("alert").waitFor();
  assert.match(await page.getByRole("alert").innerText(), /PIXEL_LIMIT/u);
  assert.equal(await canvas.count(), 0);
  assert.deepEqual(uploads, [], "No image data was posted remotely");
  assert.deepEqual(missingResources.filter((url) => /\.(?:js|mjs|css)(?:\?|$)/u.test(url)), [], "All compiled scripts and styles must resolve locally");
  assert.deepEqual(errors, [], "No unhandled browser errors");
  console.log("PASS STR-381 compiled browser consumer: real canvas S/M/L, order/visibility/opacity, PNG pixel oracle, immutable File SHA-256, bounded refusal and no uploads");
} finally {
  await browser?.close();
  await new Promise((accept) => server.close(accept));
}
