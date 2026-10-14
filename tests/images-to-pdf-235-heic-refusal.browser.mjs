/** #235: real public route rejects HEIC while keeping PNG/JPEG PDF creation. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const port = 18235;
const origin = process.env.PDF235_ORIGIN?.replace(/\/$/u, "") ?? `http://127.0.0.1:${port}`;
const server = process.env.PDF235_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"],
  { cwd: root, stdio: "ignore" });
const fixture = (name) => resolve(root, "quality/fixtures/image-format-matrix", name);
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(`${origin}/tools/images-to-pdf/`)).ok; if (ready) break; }
    catch { /* Astro is starting */ }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 300));
  }
  assert(ready, "Images to PDF public route did not start");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const offsite = [];
  const exceptions = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin + "/") && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
  });
  page.on("pageerror", (error) => exceptions.push(error.message));
  assert.equal((await page.goto(`${origin}/tools/images-to-pdf/`, { waitUntil: "networkidle" }))?.status(), 200);
  const island = page.locator('astro-island:has(input[type="file"])');
  await island.waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('astro-island:has(input[type="file"])[ssr]'), null, { timeout: 60000 });
  const picker = page.locator('input[type="file"]');
  await picker.waitFor();
  const accept = await picker.getAttribute("accept");
  assert(!/heic|heif/iu.test(accept), "Public picker still promises unapproved HEIC");
  assert.match(await page.locator(".tool-form-card .file-note").first().innerText(), /HEIC\/HEIF non disponibili/u);

  // The DOM file picker can be programmatically bypassed: reject .heic
  // immediately without starting conversion or leaving an old download.
  await picker.setInputFiles([fixture("source.png"), fixture("source.heic")]);
  await page.getByRole("alert").filter({ hasText: /HEIC\/HEIF non sono ancora disponibili/u }).waitFor();
  assert.equal(await page.locator('[data-result-class="pdf"]').count(), 0);
  assert.equal(await page.locator('.tool-form-card input[type="file"]').inputValue(), "");

  // A forged .png / image/png with a real HEIF ftyp signature bypasses
  // filename validation, but module sniffing must refuse it before decode.
  await picker.setInputFiles({
    name: "renamed.png", mimeType: "image/png", buffer: await readFile(fixture("source.heic")),
  });
  await page.getByRole("button", { name: "Crea PDF" }).click();
  await page.getByRole("alert").filter({ hasText: /HEIC\/HEIF non sono ancora disponibili/u }).waitFor();
  assert.equal(await page.locator('[data-result-class="pdf"]').count(), 0);

  await picker.setInputFiles([fixture("source.png"), fixture("source.jpg")]);
  await page.getByRole("button", { name: "Crea PDF" }).click();
  await page.locator('[data-result-class="pdf"]').waitFor({ timeout: 30000 });
  const link = page.locator('[data-result-slot="file-workspace"] a').first();
  assert(await link.count() > 0, "No verified public PDF download available");
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  assert.equal(pdf.numPages, 2, "PNG+JPEG must still produce a two-page PDF");
  await pdf.cleanup?.();

  assert.deepEqual(exceptions, [], "Browser exceptions");
  assert.deepEqual(offsite, [], "Public route should not upload source files or fetch offsite dependencies");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px overflow");
  console.log("IMAGES_TO_PDF_235_HEIC_REFUSAL_BROWSER_PASS rejection=declared+signature positive=PNG+JPEG(pdfjs:2pages) viewport=390 offsite=0");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
