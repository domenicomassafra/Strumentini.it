/**
 * STR-382 compiled consumer contract: `npm run build && node tests/str-382-consumer.browser.mjs`.
 * Uses the real PNG decoder and compiled Astro island; Chromium CDP sends native touch input.
 * The script starts a local Astro preview and never contacts production or uploads the image.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
assert(existsSync(resolve(root, "dist/tools/image-crop/index.html")), "NOT_RUN: npm run build must produce the image-crop consumer first");

async function freePort() {
  const server = createServer();
  await new Promise((resolveReady, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolveReady));
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise((done) => server.close(done));
  return address.port;
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const preview = spawn("npx", ["--no-install", "astro", "preview", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" },
});
let stderr = "";
preview.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-1600); });
const browser = await chromium.launch({ headless: true });
try {
  let available = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (preview.exitCode !== null) break;
    try {
      const response = await fetch(origin + "/tools/image-crop/");
      if (response.status === 200) { available = true; break; }
    } catch { /* Preview is still starting. */ }
    await delay(150);
  }
  assert(available, `NOT_RUN: built preview did not start: ${stderr}`);

  const context = await browser.newContext({ viewport: { width: 900, height: 850 }, hasTouch: true, isMobile: true, acceptDownloads: true });
  const page = await context.newPage();
  const offsite = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(origin + "/") || /^(blob|data):/u.test(route.request().url())) return route.continue();
    offsite.push(route.request().url());
    return route.abort();
  });
  const response = await page.goto(origin + "/tools/image-crop/", { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island[component-url*="ImageCropTool"]');
    return island && !island.hasAttribute("ssr");
  }, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Selezioni e maschere" }).click();

  const pixelBytes = Buffer.from([
    255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 80, 80, 90, 100, 255,
    255, 255, 0, 255, 20, 40, 60, 200, 150, 100, 50, 255, 10, 20, 30, 255,
    1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 30, 60, 90, 190,
  ]);
  const original = await sharp(pixelBytes, { raw: { width: 4, height: 3, channels: 4 } }).png().toBuffer();
  await page.locator('input[type="file"]').setInputFiles({ name: "alpha-oracle.png", mimeType: "image/png", buffer: original });
  await page.locator('[data-selection-source="true"]').waitFor();

  const numeric = async (field, value) => {
    const input = page.getByRole("spinbutton", { name: `Selezione ${field}` });
    await input.fill(String(value));
    await input.press("Tab");
  };
  const previewAlpha = () => page.locator('[data-selection-preview="true"]').evaluate((canvas) => ({
    width: canvas.width, height: canvas.height,
    rgba: [...canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data],
  }));

  // Native touch gesture: choose the source pixel interval [1,3) x [0,2).
  const canvas = page.locator('[data-selection-source="true"]');
  const box = await canvas.boundingBox();
  assert(box);
  const touchStart = { x: box.x + box.width * 1.5 / 4, y: box.y + box.height * 0.5 / 3, id: 1 };
  const touchEnd = { x: box.x + box.width * 2.5 / 4, y: box.y + box.height * 1.5 / 3, id: 1 };
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchStart] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchEnd] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForFunction(() => document.querySelector('[aria-label="Selezione x"]')?.value === "1");
  assert.equal(await page.locator('[aria-label="Selezione width"]').inputValue(), "2");
  const touchPixels = await previewAlpha();
  assert.deepEqual([touchPixels.width, touchPixels.height], [2, 2]);
  assert.deepEqual(touchPixels.rgba.filter((_byte, index) => index % 4 === 3), [128, 80, 200, 255]);

  // Keyboard: select [0,2) x [0,2), then move one pixel right.
  await numeric("x", 0);
  await canvas.focus();
  await canvas.press("ArrowRight");
  assert.equal(await page.locator('[aria-label="Selezione x"]').inputValue(), "1");
  assert.deepEqual(await previewAlpha(), touchPixels, "keyboard and native touch must agree pixel for pixel");

  await page.getByRole("button", { name: "Esporta PNG selezione" }).click();
  const link = page.locator('[data-result-class="image"] a[download$=".png"]').first();
  await link.waitFor({ timeout: 20_000 });
  const pending = page.waitForEvent("download");
  await link.click();
  const download = await pending;
  const output = await readFile(await download.path());
  const opened = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([opened.info.width, opened.info.height], [2, 2]);
  assert.deepEqual([...opened.data].filter((_byte, index) => index % 4 === 3), [128, 80, 200, 255]);
  const stillOriginal = await page.locator('input[type="file"]').evaluate(async (input) => [...new Uint8Array(await input.files[0].arrayBuffer())]);
  assert.deepEqual(stillOriginal, [...original], "the user's original file must remain byte-for-byte intact");

  await page.getByRole("button", { name: "Maschera su immagine intera" }).click();
  await page.getByRole("button", { name: "Ellisse" }).click();
  await numeric("x", 0);
  await numeric("y", 0);
  await numeric("width", 4);
  await numeric("height", 3);
  const masked = await previewAlpha();
  assert.deepEqual([masked.width, masked.height], [4, 3]);
  assert(masked.rgba[3] > 0 && masked.rgba[3] < 255, "elliptical edge must have fractional alpha, not a binary cutoff");
  assert.equal(masked.rgba[(1 * 4 + 1) * 4 + 3], 200, "an opaque mask interior retains source alpha");
  assert.deepEqual(offsite, [], "image selection must never use an external network service");
  assert.deepEqual(errors, [], "compiled consumer must not raise uncaught browser errors");
  console.log("PASS STR-382 compiled consumer: native touch/keyboard exact crop, PNG download, ellipse alpha boundary, immutable original, no uploads");
  await context.close();
} finally {
  await browser.close();
  preview.kill("SIGTERM");
}
