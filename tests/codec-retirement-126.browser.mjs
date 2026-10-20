// Preview acceptance for owner option B: node tests/codec-retirement-126.browser.mjs http://127.0.0.1:4987
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://127.0.0.1:4987").replace(/\/$/u, "");
const fixture = fileURLToPath(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [], offsite = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (!["blob:", "data:"].some(prefix => request.url().startsWith(prefix)) && !request.url().startsWith(base)) offsite.push(request.url());
  });
  assert.equal((await page.goto(`${base}/tools/pdf-password-check-remove/`, { waitUntil: "networkidle" })).status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island')].some(el =>
    el.getAttribute('component-url')?.includes('PdfPasswordCheckRemoveTool') && !el.hasAttribute('ssr')));
  const mode = page.locator('select').filter({ has: page.locator('option[value="check"]') });
  assert.deepEqual(await mode.locator("option").evaluateAll(options => options.map(option => option.value)), ["check", "remove"]);
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  assert.match(await page.locator(".file-note").filter({ hasText: /QPDF/u }).first().innerText(), /ritirati/u);
  await page.locator('input[type="file"]').first().setInputFiles(fixture);
  await page.getByRole("button", { name: "Controlla cifratura" }).click();
  await page.getByText("PDF non cifrato").first().waitFor({ timeout: 25_000 });
  await mode.selectOption("remove");
  await page.getByRole("button", { name: "Crea PDF senza cifratura" }).click();
  await page.locator('[data-result-class="pdf"]').waitFor({ timeout: 25_000 });
  assert.equal(await page.locator('option[value="protect"]').count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(offsite, []);
  await page.goto(`${base}/tools/video-inspector/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every(island => !island.hasAttribute('ssr')));
  assert.match(await page.locator('[data-video-codec-retired-126]').innerText(), /Mediabunny/u);
  assert.equal(await page.locator('[data-video-transform-234], [data-video-gif-306]').count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(offsite, []);
  console.log("STR-126 PREVIEW_BROWSER_PASS: real PDF check + plain copy, codec controls absent on PDF/video routes, 390px, no offsite requests or JS exceptions");
} finally { await browser.close(); }
