/** #339 PDF-family acceptance: real rotated output, no implicit browser save. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const port = 19473;
const origin = process.env.DOWNLOAD339_PDF_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.DOWNLOAD339_PDF_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", `${port}`], { stdio: "ignore" });
const fixture = await readFile("quality/fixtures/pdf-gold/simple-3page.pdf");
const consentKey = "strumentini:auto-download:v1";
let browser;
try {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(origin + "/tools/pdf-rotate/")).ok) break; } catch { /* local host only */ }
    if (server?.exitCode != null) throw new Error(`Astro server failed: ${server.exitCode}`);
    if (attempt === 119) throw new Error("PDF route did not start");
    await sleep(250);
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  // Popup-denied browsers must still allow the normal local download buttons.
  await page.addInitScript(() => { window.open = () => null; });
  const egress = [];
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request();
    if (["GET", "HEAD"].includes(request.method()) && (request.url().startsWith(origin + "/") || /^(blob|data):/u.test(request.url()))) return route.continue();
    egress.push(request.method() + " " + request.url());
    return route.abort();
  });
  const hydrate = async () => {
    await page.goto(origin + "/tools/pdf-rotate/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const island = document.querySelector('astro-island[component-url*="PdfRotateTool"]');
      return island && !island.hasAttribute("ssr");
    });
  };
  await hydrate();
  const form = page.locator("form.tool-operation").first();
  const consent = page.locator('[data-download-pdf339] input[type="checkbox"]');
  const consentStatus = page.locator("[data-download-pdf339-status]");
  const sharedScope = page.locator("[data-download-pdf339-scope]");
  const produce = async () => {
    await form.locator('input[type="file"]').first().setInputFiles({ name: "input.pdf", mimeType: "application/pdf", buffer: fixture });
    await form.getByPlaceholder("1-3, 5").fill("1");
    await form.getByRole("button", { name: "Ruota pagine" }).click();
    await page.locator('[data-result-class="pdf"]').waitFor();
  };
  const assertRotated = async (event) => {
    const bytes = await readFile(await event.path());
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-", "Downloaded bytes must be real PDF");
    const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
    try {
      const pdf = await loading.promise;
      assert.equal(pdf.numPages, 3, "Readback PDF must retain the three source pages");
      assert.equal((await pdf.getPage(1)).rotate, 90, "Readback must actually rotate page one");
    } finally { await loading.destroy(); }
  };
  assert.match(await page.locator("[data-download-pdf339]").innerText(), /Download automatico condiviso.*WAV.*JSON.*CSV.*PDF/u);
  assert.match(await sharedScope.innerText(), /se hai già dato il consenso per WAV, JSON o CSV.*anche per i prossimi PDF/u);
  assert.match(await sharedScope.innerText(), /disattivarlo qui revoca il consenso per tutti/u);
  assert.equal(await consent.isChecked(), false, "Default auto OFF");
  assert.equal(await page.evaluate(key => localStorage.getItem(key), consentKey), null);
  let count = 0;
  page.on("download", () => count++);
  // Consent created on another supported producer is already global, not PDF-isolated.
  await page.evaluate(key => localStorage.setItem(key, "enabled"), consentKey);
  await hydrate();
  await page.waitForFunction(() => document.querySelector('[data-download-pdf339] input')?.checked === true);
  assert.match(await sharedScope.innerText(), /Preferenza unica per tutti gli strumenti supportati/u);
  assert.equal(count, 0, "Prior cross-family opt-in must not download a file merely on page load");
  await page.evaluate(key => localStorage.removeItem(key), consentKey);
  await hydrate();
  assert.equal(await consent.isChecked(), false, "Cleared shared preference must restore OFF");
  await produce();
  await sleep(250);
  assert.equal(count, 0, "Never download initial result before consent");
  const manualWait = page.waitForEvent("download");
  await page.locator('[data-result-action="download"]').first().click();
  await assertRotated(await manualWait);

  await consent.check();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), consentKey), "enabled");
  await sleep(250);
  assert.equal(count, 1, "Enabling cannot download previous result retroactively");
  const futureWait = page.waitForEvent("download");
  await produce();
  await assertRotated(await futureWait);
  await sleep(150);
  assert.equal(count, 2, "Exactly one automatic PDF for next verified run");

  await page.evaluate(() => {
    window.__savedObjectUrl = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
      // Preview uses Blob URLs too; deny only the #339 download request.
      if (new Error().stack?.includes("requestBrowserDownload339")) throw new DOMException("download denied", "SecurityError");
      return window.__savedObjectUrl.call(URL, blob);
    };
  });
  await produce();
  try { await consentStatus.getByText("Download automatico non disponibile", { exact: false }).waitFor({ timeout: 12_000 }); }
  catch (error) { throw new Error(`Denied-auto status not observed: ${await consentStatus.allInnerTexts()} | page errors: ${pageErrors.join(";")}`, { cause: error }); }
  assert.equal(count, 2, "Denied browser API must not claim a download");
  await page.evaluate(() => { URL.createObjectURL = window.__savedObjectUrl; });
  const recoveredWait = page.waitForEvent("download");
  await page.locator('[data-result-action="download"]').first().click();
  await assertRotated(await recoveredWait);

  await page.evaluate(key => {
    const oldRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (name) {
      if (name === key) throw new DOMException("remove denied", "SecurityError");
      return oldRemove.call(this, name);
    };
  }, consentKey);
  await consent.click();
  assert.equal(await consent.isChecked(), true, "Failed revoke cannot falsely display OFF");
  await consentStatus.getByText("Impossibile revocare", { exact: false }).waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), consentKey), "enabled");
  await hydrate();
  await page.waitForFunction(key => document.querySelector('[data-download-pdf339] input')?.checked === true && localStorage.getItem(key) === "enabled", consentKey);
  await consent.uncheck();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), consentKey), null);
  await produce();
  await sleep(250);
  assert.equal(count, 3, "Revocation must prevent subsequent automatic downloads");
  await context.close();

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await denied.addInitScript(key => {
    const oldSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("storage denied", "SecurityError");
      return oldSet.call(this, name, value);
    };
  }, consentKey);
  const deniedPage = await denied.newPage();
  await deniedPage.goto(origin + "/tools/pdf-rotate/", { waitUntil: "domcontentloaded" });
  await deniedPage.waitForFunction(() => {
    const island = document.querySelector('astro-island[component-url*="PdfRotateTool"]');
    return island && !island.hasAttribute("ssr");
  });
  const deniedConsent = deniedPage.locator('[data-download-pdf339] input[type="checkbox"]');
  await deniedConsent.waitFor();
  await deniedConsent.click();
  assert.equal(await deniedConsent.isChecked(), false, "Denied persistence must not give consent");
  await deniedPage.locator('[data-download-pdf339-status]').getByText("Impossibile salvare", { exact: false }).waitFor();
  await denied.close();
  assert.deepEqual(egress, [], "PDF bytes must stay local, no upload/network write");
  assert.deepEqual(pageErrors, [], "No uncaught browser exceptions");
  console.log("#339 PDF browser PASS: verified PDF byte/readback, manual, OFF, future-only auto, API/storage denial, popup denied, failed revoke+reload, true revoke, no upload, 390px");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
