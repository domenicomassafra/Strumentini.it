import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createPdfToolkit } from "../src/engines/pdf/vendor/pdfstudio/index.js";

const base = process.env.PDF332_TEST_BASE_URL ?? "http://127.0.0.1:4390";
const fixture = fileURLToPath(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const offsite = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).origin !== base) offsite.push(request.url()); });
  await page.goto(`${base}/tools/pdf-password-check-remove/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island')].some((el) =>
    el.getAttribute('component-url')?.includes('PdfPasswordCheckRemoveTool') && !el.hasAttribute('ssr')), null, { timeout: 60_000 });
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.locator('select').filter({ has: page.locator('option[value="protect"]') }).selectOption("protect");
  await page.locator('input[aria-label="Nuova password per proteggere il PDF"]').waitFor({ timeout: 15000 }).catch(async (error) => {
    throw new Error(`${error}; selects=${JSON.stringify(await page.locator('select').evaluateAll(elements => elements.map(el => ({value:el.value,html:el.outerHTML.slice(0,400)}))))}; passwordInputs=${await page.locator('input[type="password"]').count()}; errors=${JSON.stringify(errors)}`);
  });
  await page.locator('input[aria-label="Nuova password per proteggere il PDF"]').fill("prova-STR032-aes256");
  await page.getByRole("button", { name: "Crea PDF protetto AES-256" }).click();
  try {
    await page.locator('[data-result-class="pdf"]').waitFor({ timeout: 25_000 });
  } catch (error) {
    const visible = await page.locator('[role="alert"], [role="status"], .error, .tool-error, [data-result-class], .tool-operation').allTextContents();
    throw new Error(`PDF preview not ready: ${String(error)}; visible=${JSON.stringify(visible).slice(0, 2500)}; pageErrors=${JSON.stringify(errors)}`);
  }
  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Scarica pdf-protetto-aes256.pdf").first().click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "pdf-protetto-aes256.pdf");
  const bytes = new Uint8Array(await readFile(await download.path()));
  const toolkit = await createPdfToolkit();
  assert.equal(await toolkit.isEncrypted(bytes), true);
  assert.equal(await toolkit.requiresPassword(bytes), true);
  const info = await toolkit.getInfo(bytes, { password: "prova-STR032-aes256" });
  assert.equal(info.pageCount, 2);
  assert.equal(info.encryption?.bits, 256);
  assert.equal(info.encryption?.method, "AESv3");
  assert.deepEqual(errors, []);
  assert.deepEqual(offsite, []);
  console.log("STR-032 REAL_BROWSER_PASS: PDF local AES-256 encrypted and downloaded; password reopen, 390px viewport, no external requests or JS errors");
} finally { await browser.close(); }
