/** #339 wave14 — existing single image-compression PNG UI, byte-level browser acceptance.
 * Execute ONLY after a fresh compiled build is served locally:
 * DOWNLOAD339_COMPRESSION_ORIGIN=http://127.0.0.1:19541 DOWNLOAD339_COMPRESSION_BROWSER=webkit node tests/download-wave14-339.browser.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "@playwright/test";
import sharp from "sharp";

const origin = process.env.DOWNLOAD339_COMPRESSION_ORIGIN;
assert(origin && /^http:\/\/127\.0\.0\.1:\d+$/u.test(origin), "Supply a local already-built static preview through DOWNLOAD339_COMPRESSION_ORIGIN");
const engineName = process.env.DOWNLOAD339_COMPRESSION_BROWSER ?? "chromium";
const browsers = { chromium, firefox, webkit };
assert(Object.hasOwn(browsers, engineName), "Unsupported browser engine");
const key = "strumentini:auto-download:v1";
const width = 96;
const height = 64;
const pixels = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 3;
  pixels.set([(x * 7 + y * 3) % 256, (y * 5 + x * 2) % 256, (x * 11 + y * 13) % 256], i);
}
const inputPng = await sharp(pixels, { raw: { width, height, channels: 3 } })
  .png({ compressionLevel: 0, palette: false }).toBuffer();
const input = { name: "compression-339.png", mimeType: "image/png", buffer: inputPng };
const secondInput = { name: "compression-339-second.png", mimeType: "image/png", buffer: inputPng };
let browser;
try {
  const response = await fetch(origin + "/tools/image-compression/");
  assert.equal(response.status, 200, "Compiled compression route must exist");
  browser = await browsers[engineName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  const networkWrites = [];
  const watchPage = async p => {
    p.on("pageerror", e => pageErrors.push(e.message));
    await p.route("**/*", route => {
      const req = route.request();
      if (["GET", "HEAD"].includes(req.method()) && (req.url().startsWith(origin + "/") || /^(blob|data):/u.test(req.url()))) return route.continue();
      networkWrites.push(req.method() + " " + req.url());
      return route.abort();
    });
  };
  await context.addInitScript(() => { window.open = () => null; });
  await watchPage(page);
  const hydrate = async p => {
    await p.goto(origin + "/tools/image-compression/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => {
      const island = document.querySelector('astro-island[component-url*="ImageCompressionTool"]');
      return island && !island.hasAttribute("ssr");
    }, null, { timeout: 30_000 });
  };
  const auto = page.locator('[data-download-compression339] input[type="checkbox"]');
  const status = page.locator("[data-download-compression339-status]");
  const pngLink = p => p.locator('[data-result-class="image"] a[download$=".png"]').first();
  let downloads = 0;
  page.on("download", () => downloads++);
  const runPng = async (p = page) => {
    await p.locator('form input[type="file"]').first().setInputFiles(input);
    await p.getByRole("button", { name: "Esegui in locale" }).click();
    await pngLink(p).waitFor({ timeout: 20_000 });
  };
  const currentBytes = async (p = page) => Buffer.from(await p.evaluate(async () => {
    const anchor = document.querySelector('[data-result-class="image"] a[download$=".png"]');
    if (!anchor?.href) throw Error("No verified download link for current PNG");
    return [...new Uint8Array(await (await fetch(anchor.href)).arrayBuffer())];
  }));
  const validatePng = async (event, expected) => {
    const bytes = await readFile(await event.path());
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.deepEqual(bytes, expected, "Downloaded bytes differ from the verified PNG result on this job");
    const decoded = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.width, width);
    assert.equal(decoded.info.height, height);
    assert.deepEqual(decoded.data, pixels, "Independent Sharp/libvips pixel decode must preserve source pixel values");
  };

  await hydrate(page);
  assert.equal(await auto.isChecked(), false, "No prior consent defaults OFF");
  assert.equal(await page.evaluate(k => localStorage.getItem(k), key), null);
  await runPng();
  assert.equal(downloads, 0, "Initial PNG job cannot auto-download without consent");
  const firstBytes = await currentBytes();
  const manual = page.waitForEvent("download");
  await pngLink(page).click();
  await validatePng(await manual, firstBytes);
  assert.equal(downloads, 1, "Explicit manual download works OFF");

  await auto.check();
  assert.equal(await page.evaluate(k => localStorage.getItem(k), key), "enabled");
  await page.waitForTimeout(180);
  assert.equal(downloads, 1, "Turning ON cannot retro-download completed PNG");
  const automatic = page.waitForEvent("download");
  await runPng();
  await validatePng(await automatic, await currentBytes());
  await page.waitForTimeout(180);
  assert.equal(downloads, 2, "Exactly one automatic download for next verified PNG");

  await page.locator('form input[type="file"]').first().setInputFiles({
    name: "invalid-339.png", mimeType: "image/png", buffer: Buffer.from("not a PNG"),
  });
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  await page.locator("[data-tool-error]").waitFor({ timeout: 12_000 });
  assert.equal(downloads, 2, "Malformed/unverified input must not trigger an automatic PNG");

  await page.evaluate(() => {
    window.__originalClick339 = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.hidden && this.download?.endsWith(".png")) throw new DOMException("blocked", "SecurityError");
      return window.__originalClick339.call(this);
    };
  });
  await runPng();
  await status.filter({ hasText: /Download automatico non disponibile/u }).waitFor();
  assert.equal(downloads, 2, "Denied hidden anchor must not signal a download");
  const fallback = page.waitForEvent("download");
  await pngLink(page).click();
  await validatePng(await fallback, await currentBytes());
  assert.equal(downloads, 3);
  await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__originalClick339; });

  // With global opt-in ON, JPEG must never be silently downloaded.
  await page.locator('form select').filter({ has: page.locator('option[value="image/jpeg"]') }).first().selectOption("image/jpeg");
  await page.locator('form input[type="file"]').first().setInputFiles(input);
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  await page.locator('[data-result-class="image"] a[download$=".jpg"]').first().waitFor();
  assert.equal(downloads, 3, "JPEG output excluded even with global preference enabled");
  // Restore PNG to test batch exclusion, even when every batch output is PNG.
  await page.locator('form select').filter({ has: page.locator('option[value="image/png"]') }).first().selectOption("image/png");
  await page.getByLabel(/Comprimi più immagini in coda/u).check();
  assert.equal(await page.locator("[data-download-compression339]").count(), 0, "Batch should not expose single-output auto");
  await page.locator('form input[type="file"]').first().setInputFiles([input, secondInput]);
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  await page.locator("[data-image-batch-details]").waitFor({ timeout: 25_000 });
  assert.equal(downloads, 3, "PNG batch must never auto-download individuals or ZIP");

  await page.getByLabel(/Comprimi più immagini in coda/u).uncheck();
  await page.evaluate(k => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (name) {
      if (name === k) throw new DOMException("storage remove denied", "SecurityError");
      return remove.call(this, name);
    };
  }, key);
  await auto.click();
  assert.equal(await auto.isChecked(), true, "Denied revoke must display persisted ON truthfully");
  await status.filter({ hasText: /Impossibile revocare/u }).waitFor();
  await hydrate(page);
  await page.waitForFunction(() => document.querySelector('[data-download-compression339] input')?.checked === true);
  assert.equal(downloads, 3, "Restoring globally ON preference never downloads previous result");
  await auto.uncheck();
  assert.equal(await page.evaluate(k => localStorage.getItem(k), key), null, "Successful global revocation persisted");
  await runPng();
  assert.equal(downloads, 3, "Subsequent PNG after revocation must NOT auto-download");

  await context.close();
  const denied = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await denied.addInitScript(k => {
    window.open = () => null;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === k) throw new DOMException("storage set denied", "SecurityError");
      return set.call(this, name, value);
    };
  }, key);
  const deniedPage = await denied.newPage();
  await watchPage(deniedPage);
  await hydrate(deniedPage);
  const deniedAuto = deniedPage.locator('[data-download-compression339] input[type="checkbox"]');
  await deniedAuto.click();
  assert.equal(await deniedAuto.isChecked(), false, "Storage write denied: checkbox stays OFF");
  await deniedPage.locator("[data-download-compression339-status]").filter({ hasText: /Impossibile salvare/u }).waitFor();
  let deniedDownloads = 0;
  deniedPage.on("download", () => deniedDownloads++);
  await runPng(deniedPage);
  assert.equal(deniedDownloads, 0, "Storage denial prevents automatic PNG");
  const deniedBytes = await currentBytes(deniedPage);
  const manualDenied = deniedPage.waitForEvent("download");
  await pngLink(deniedPage).click();
  await validatePng(await manualDenied, deniedBytes);
  assert.equal(deniedDownloads, 1, "Manual remains available without storage");
  await denied.close();
  assert.deepEqual(networkWrites, [], "No uploads, POSTs or external requests");
  assert.deepEqual(pageErrors, [], "No uncaught browser errors");
  console.log(`#339 image-compression PNG ${engineName} PASS: Sharp verified pixels + actual byte-equal manual/auto, OFF/no retro, excluded JPEG/batch, denied browser/storage, global revoke, popup blocked, zero upload, viewport 390`);
} finally {
  await browser?.close();
}
