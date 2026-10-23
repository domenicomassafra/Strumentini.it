/** STR-028: run on the *compiled* dist, never against Vite's source transformations.
 * Self-serves only the existing static artifact, then checks real browser downloads.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { preview } from "vite";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const server = await preview({ configFile: false, root, build: { outDir: "dist" },
  preview: { host: "127.0.0.1", port: 0, strictPort: false } });
const address = server.httpServer.address();
assert(address && typeof address !== "string", "compiled-site static server unavailable");
const origin = `http://127.0.0.1:${address.port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const outside = [], errors = [];
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  context.on("request", (request) => {
    if (!request.url().startsWith(origin) && !/^(blob|data):/u.test(request.url())) outside.push(request.url());
  });
  const page = await context.newPage();
  const input = Buffer.alloc(128 * 96 * 4);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4;
    input[i] = (x * 13 + y * 5) & 255;
    input[i + 1] = (x * 7 + y * 19) & 255;
    input[i + 2] = (x * 23 + y) & 255;
    input[i + 3] = 255;
  }
  const png = await sharp(input, { raw: { width: 128, height: 96, channels: 4 } }).png().toBuffer();
  const original = Buffer.from(png);
  assert.equal((await page.goto(`${origin}/tools/image-format-conversion/`))?.status(), 200);
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island[component-url*="ImageFormatConversionTool"]');
    return island && !island.hasAttribute("ssr");
  });
  assert.equal(await page.locator('[data-image-family-matrix-028] tr[data-evidence]').count(), 7);
  await page.locator('form input[type="file"]').first().setInputFiles({ name: "source.png", mimeType: "image/png", buffer: png });
  await page.locator('form select').first().selectOption("image/webp");
  await page.getByRole("button", { name: "Esegui in locale" }).first().click();
  const send = page.locator('[data-image-compression-handoff-028]');
  await send.waitFor({ timeout: 30_000 });
  const convertedDownload = page.waitForEvent("download");
  await page.locator('a[download$=".webp"]').first().click();
  const convertedBytes = await readFile(await (await convertedDownload).path());
  assert.equal((await sharp(convertedBytes).metadata()).format, "webp", "independent WebP decoder");
  const popupEvent = page.waitForEvent("popup");
  await send.click();
  const popup = await popupEvent;
  await popup.locator('[data-handoff-337]').waitFor({ timeout: 25_000 });
  assert.match(await popup.locator('[data-handoff-337]').innerText(), /avvia manualmente/u);
  assert.equal(new URL(popup.url()).hash, "", "one-use token must be removed");
  assert.equal(await popup.locator('form select').first().inputValue(), "image/webp");
  assert.equal(await popup.locator('[data-result-class="image"]').count(), 0, "no auto-encode");
  assert.equal(await popup.locator('[data-image-family-matrix-028] tr[data-evidence]').count(), 7);
  await popup.locator('[data-target-image-compression] input[type="number"]').first().fill("2");
  await popup.getByRole("button", { name: "Esegui in locale" }).click();
  await popup.locator('[data-result-class="image"] a[download$=".webp"]').first().waitFor({ timeout: 30_000 });
  assert.match(await popup.locator('[data-result-slot="media-metrics"]').innerText(), /Obiettivo/u);
  const compressedDownload = popup.waitForEvent("download");
  await popup.locator('a[download$=".webp"]').first().click();
  const compressedBytes = await readFile(await (await compressedDownload).path());
  const compressed = await sharp(compressedBytes).metadata();
  assert.deepEqual([compressed.format, compressed.width, compressed.height], ["webp", 128, 96]);
  assert.deepEqual(png, original, "source must remain byte-identical");

  // Refusal: a corrupted file cannot produce a downloadable result.
  const bad = await context.newPage();
  assert.equal((await bad.goto(`${origin}/tools/image-compression/`))?.status(), 200);
  await bad.locator('fieldset[data-image-compression-hydration-gate]:not([disabled])').waitFor();
  await bad.locator('form input[type="file"]').first().setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from([1, 2, 3]) });
  await bad.getByRole("button", { name: "Esegui in locale" }).first().click();
  await bad.locator('[data-tool-error]').waitFor({ timeout: 20_000 });
  assert.equal(await bad.locator('a[download]').count(), 0);
  assert.deepEqual(outside, [], "no remote processing or upload");
  assert.deepEqual(errors, [], "no uncaught browser exception");
  await context.close();
  console.log(`PASS STR-028: compiled conversion alias/format matrix, WebP Sharp decoder, one-shot handoff, target compression, refused corrupt file; ${compressedBytes.length} output bytes`);
} finally {
  if (browser) await browser.close();
  await new Promise((done, fail) => server.httpServer.close((error) => error ? fail(error) : done()));
}
