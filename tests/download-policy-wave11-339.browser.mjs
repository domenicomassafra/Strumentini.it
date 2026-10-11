/** #339 wave11: real verified PNG from image-format-conversion, never silent download.
 * Browser cross-check against a pre-built static Astro preview, never Vite dev:
 * DOWNLOAD339_PNG_ORIGIN=http://127.0.0.1:19541 DOWNLOAD339_PNG_BROWSER=firefox node tests/download-policy-wave11-339.browser.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, firefox, webkit } from "@playwright/test";

const origin = process.env.DOWNLOAD339_PNG_ORIGIN;
if (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/u.test(origin)) {
  throw new Error("Set DOWNLOAD339_PNG_ORIGIN to an already-running LOCAL STATIC Astro preview, e.g. http://127.0.0.1:19541; never use Vite dev for this test.");
}
const browserName = process.env.DOWNLOAD339_PNG_BROWSER ?? "chromium";
const engines = { chromium, firefox, webkit };
if (!Object.hasOwn(engines, browserName)) throw new Error(`Unsupported DOWNLOAD339_PNG_BROWSER: ${browserName}`);
const consentKey = "strumentini:auto-download:v1";
const sample = await readFile("quality/fixtures/image-format-matrix/source.gif");
let browser;
try {
  for (let n = 0; n < 120; n++) {
    try { if ((await fetch(origin + "/tools/image-format-conversion/", { signal: AbortSignal.timeout(3_000) })).ok) break; } catch { /* local only */ }
    if (n === 119) throw Error(`Static PNG route did not respond: ${origin}`);
    await sleep(250);
  }
  browser = await engines[browserName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  const egress = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  // Explicit popup denial must not block the in-page download anchor.
  await page.addInitScript(() => { window.open = () => null; });
  await page.route("**/*", route => {
    const request = route.request();
    if (["GET", "HEAD"].includes(request.method()) && (request.url().startsWith(origin + "/") || /^(blob|data):/u.test(request.url()))) return route.continue();
    egress.push(request.method() + " " + request.url());
    return route.abort();
  });
  const hydrate = async () => {
    await page.goto(origin + "/tools/image-format-conversion/", { waitUntil: "domcontentloaded" });
    try {
      await page.waitForFunction(() => {
        const island = document.querySelector('astro-island[component-url*="ImageFormatConversionTool"]');
        return island && !island.hasAttribute("ssr");
      }, null, { timeout: 90_000 });
    } catch (error) {
      const islands = await page.locator("astro-island").evaluateAll(entries => entries.map(node => ({
        component: node.getAttribute("component-url"), ssr: node.hasAttribute("ssr"),
      })));
      throw new Error(`${browserName} static PNG island hydration failed: ${JSON.stringify({ islands, pageErrors })}`, { cause: error });
    }
  };
  const auto = page.locator('[data-download-png339] input[type="checkbox"]');
  const status = page.locator("[data-download-png339-status]");
  let count = 0;
  page.on("download", () => count++);

  const run = async () => {
    await page.locator('form input[type="file"]').first().setInputFiles({ name: "source.gif", mimeType: "image/gif", buffer: sample });
    await page.getByRole("button", { name: "Esegui in locale" }).click();
    await page.locator('[data-result-class="image"]').waitFor({ timeout: 15_000 });
    const outputLink = page.locator('[data-result-class="image"] a[download$=".png"]').first();
    await outputLink.waitFor();
    return outputLink;
  };
  const checkPng = async (download) => {
    const bytes = await readFile(await download.path());
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), 2);
    assert.equal(bytes.readUInt32BE(20), 2);
    return bytes;
  };

  await hydrate();
  assert.equal(await auto.isChecked(), false, "Default OFF");
  assert.equal(await page.evaluate(key => localStorage.getItem(key), consentKey), null);
  let outputLink = await run();
  await sleep(250);
  assert.equal(count, 0, "No silent first PNG download");
  const expectedBytes = Buffer.from(await page.evaluate(async selector => {
    const href = document.querySelector(selector)?.href;
    if (!href) throw Error("Verified PNG download link missing");
    return [...new Uint8Array(await (await fetch(href)).arrayBuffer())];
  }, '[data-result-class="image"] a[download$=".png"]'));
  const manual = page.waitForEvent("download");
  await outputLink.click();
  assert.deepEqual(await checkPng(await manual), expectedBytes, "Manual download bytes must equal verified output");

  await auto.check();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), consentKey), "enabled");
  await sleep(200);
  assert.equal(count, 1, "Enabling opt-in must never re-download already-visible PNG");
  const automatic = page.waitForEvent("download");
  outputLink = await run();
  const autoPngBytes = await checkPng(await automatic);
  assert.deepEqual(autoPngBytes, expectedBytes, "Automatic download must contain true verified PNG bytes");
  await sleep(150);
  assert.equal(count, 2, "Exactly one automatic PNG on new job");

  // Simulate a browser refusing the programmatic hidden download anchor.
  // Do not rely on function names in Error.stack: production bundles may
  // minify the requestBrowserDownload339 symbol. Keep result/preview Blob
  // URLs working so an ordinary manual pointer click remains possible.
  await page.evaluate(() => {
    window.__originalAnchorClick339 = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.hidden && this.download?.endsWith(".png")) throw new DOMException("denied", "SecurityError");
      return window.__originalAnchorClick339.call(this);
    };
  });
  await run();
  await status.filter({ hasText: /Download automatico non disponibile/u }).waitFor();
  assert.equal(count, 2, "Denied automatic anchor must not add downloads");
  const recoveredManual = page.waitForEvent("download");
  await page.locator('[data-result-class="image"] a[download$=".png"]').first().click();
  assert.deepEqual(await checkPng(await recoveredManual), expectedBytes);
  await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__originalAnchorClick339; });

  // Browser forbids removing persisted consent: do not fake OFF.
  await page.evaluate(key => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (name) {
      if (name === key) throw new DOMException("denied", "SecurityError");
      return remove.call(this, name);
    };
  }, consentKey);
  await auto.click();
  assert.equal(await auto.isChecked(), true, "Failed revoke cannot falsely show OFF");
  await status.filter({ hasText: /Impossibile revocare/u }).waitFor();
  await hydrate();
  await page.waitForFunction(() => document.querySelector('[data-download-png339] input')?.checked === true);
  await auto.uncheck();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), consentKey), null);
  await run();
  await sleep(200);
  assert.equal(count, 3, "Successfully revoked consent must prevent new auto PNG");
  await context.close();

  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await deniedContext.addInitScript(key => {
    window.open = () => null;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("storage denied", "SecurityError");
      return set.call(this, name, value);
    };
  }, consentKey);
  const deniedPage = await deniedContext.newPage();
  deniedPage.on("pageerror", error => pageErrors.push(error.message));
  await deniedPage.route("**/*", route => {
    const request = route.request();
    if (["GET", "HEAD"].includes(request.method()) && (request.url().startsWith(origin + "/") || /^(blob|data):/u.test(request.url()))) return route.continue();
    egress.push(request.method() + " " + request.url());
    return route.abort();
  });
  await deniedPage.goto(origin + "/tools/image-format-conversion/", { waitUntil: "domcontentloaded" });
  await deniedPage.waitForFunction(() => {
    const island = document.querySelector('astro-island[component-url*="ImageFormatConversionTool"]');
    return island && !island.hasAttribute("ssr");
  });
  const deniedAuto = deniedPage.locator('[data-download-png339] input');
  // A denied storage write keeps this controlled checkbox OFF. Playwright's
  // `.check()` would incorrectly require it to remain checked after click.
  await deniedAuto.click();
  assert.equal(await deniedAuto.isChecked(), false);
  await deniedPage.locator("[data-download-png339-status]").filter({ hasText: /Impossibile salvare/u }).waitFor();
  let deniedDownloads = 0;
  deniedPage.on("download", () => deniedDownloads++);
  await deniedPage.locator('form input[type="file"]').first().setInputFiles({ name: "source.gif", mimeType: "image/gif", buffer: sample });
  await deniedPage.getByRole("button", { name: "Esegui in locale" }).click();
  await deniedPage.locator('[data-result-class="image"] a[download$=".png"]').first().waitFor();
  assert.equal(deniedDownloads, 0);
  // Compare this specific produced PNG with its own Blob URL. Separate
  // independent encodes may legitimately differ in ancillary PNG bytes.
  const deniedExpected = Buffer.from(await deniedPage.evaluate(async selector => {
    const href = document.querySelector(selector)?.href;
    if (!href) throw Error("Denied-storage context PNG output missing");
    return [...new Uint8Array(await (await fetch(href)).arrayBuffer())];
  }, '[data-result-class="image"] a[download$=".png"]'));
  const deniedManual = deniedPage.waitForEvent("download");
  await deniedPage.locator('[data-result-class="image"] a[download$=".png"]').first().click();
  assert.deepEqual(await checkPng(await deniedManual), deniedExpected,
    "Storage denial preserves exact bytes of that context's verified PNG");
  await deniedContext.close();

  assert.deepEqual(egress, [], "No HTTP upload or off-origin egress");
  assert.deepEqual(pageErrors, [], "No page exceptions");
  console.log(`#339 PNG ${browserName} PASS: verified 2x2 PNG bytes manual/auto, OFF, no retro, popup/hidden-anchor/storage denied, global revoke/reload, 390px, zero upload`);
} finally {
  await browser?.close();
}
