/** Real Chromium local-server OCR acceptance; never mocks recognized text. */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const base = process.env.OCR246_TEST_BASE_URL ?? "http://127.0.0.1:4378";
const expected = "Fattura numero 12345 - Totale euro 678,90";
const sample = resolve("spikes/heavy-local-feasibility/public/corpus/ocr-it.png");
assert.equal(createHash("sha256").update(await readFile(sample)).digest("hex"),
  "1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b");

let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const allRequests = [];
  const runtimeErrors = [];
  page.on("request", (req) => allRequests.push(req.url()));
  page.on("pageerror", (err) => runtimeErrors.push(err.message));
  const route = new URL("/tools/ocr-italiano-locale-246/", base);
  await page.goto(route.href, { waitUntil: "networkidle", timeout: 25_000 });
  assert.match(await page.title(), /OCR immagini in italiano/u);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  assert.equal(allRequests.filter((u) => u.includes("/ocr-246/")).length, 0,
    "OCR runtime must not be loaded on page visit");
  await page.locator("#ocr246-file").setInputFiles(sample);
  assert.equal(allRequests.filter((u) => u.includes("/ocr-246/")).length, 0,
    "OCR runtime must not load merely on file selection");
  await page.locator("[data-ocr-run]").click();
  await page.locator("[data-ocr-result]").waitFor({ state: "visible", timeout: 95_000 });
  const text = (await page.locator('textarea[aria-label="Testo OCR italiano"]').inputValue()).replace(/\s+/gu, " ").trim();
  assert.equal(text, expected);
  assert.match(await page.locator("[data-ocr-confidence]").innerText(), /Tesseract/u);
  assert.ok(allRequests.some((u) => u.endsWith("ita.traineddata.gz")), "must fetch locally vendored ITA traineddata");
  assert.ok(allRequests.some((u) => u.includes("tesseract-core") && u.includes(".wasm")), "must fetch local Tesseract WASM core");
  const offsite = allRequests.filter((u) => u.startsWith("http") && new URL(u).origin !== route.origin);
  assert.deepEqual(offsite, [], `OCR browser made offsite requests: ${offsite}`);
  assert.deepEqual(runtimeErrors, [], `browser page JavaScript errors: ${runtimeErrors}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false,
    "390px mobile viewport should not overflow horizontally");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Scarica TXT locale/u }).click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), "ocr-italiano-246.txt");
  assert.equal((await readFile(await download.path(), "utf8")).replace(/\s+/gu, " ").trim(), expected);

  // Reproduce the independently observed RAW-90 failure input, then correct
  // orientation only by explicit user choice (270 clockwise); never claim
  // automatic orientation detection based on Tesseract's confidence score.
  const rotated = await sharp(await readFile(sample)).rotate(90).png().toBuffer();
  const rotatedInfo = await sharp(rotated).metadata();
  assert.equal(rotatedInfo.width, 240);
  assert.equal(rotatedInfo.height, 1280);
  await page.locator("#ocr246-file").setInputFiles({ name: "fattura-ruotata-90.png", mimeType: "image/png", buffer: rotated });
  await page.locator("#ocr246-rotation").selectOption("270");
  await page.locator("[data-ocr-run]").click();
  await page.waitForFunction(() => Boolean(document.querySelector("[data-ocr-result]")) ||
    document.querySelector("[data-ocr-status]")?.textContent?.startsWith("OCR non completato:"), null, { timeout: 95_000 });
  const rotationStatus = await page.locator("[data-ocr-status]").innerText();
  assert.equal(await page.locator("[data-ocr-result]").count(), 1,
    `manual rotation OCR failed: ${rotationStatus}; errors=${runtimeErrors.join("; ")}`);
  const corrected = (await page.locator('textarea[aria-label="Testo OCR italiano"]').inputValue()).replace(/\s+/gu, " ").trim();
  assert.equal(corrected, expected, "real browser/Tesseract must recognize the actually corrected raw 90-degree image");
  assert.match(await page.locator("[data-ocr-result]").innerText(), /Correzione manuale applicata: 270°/u);
  const rotatedDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Scarica TXT locale/u }).click();
  const correctedDownload = await rotatedDownloadPromise;
  assert.equal((await readFile(await correctedDownload.path(), "utf8")).replace(/\s+/gu, " ").trim(), expected);
  assert.deepEqual(allRequests.filter((u) => u.startsWith("http") && new URL(u).origin !== route.origin), [],
    "rotated OCR must not fetch from external origins");
  assert.deepEqual(runtimeErrors, [], "rotated OCR must not cause JS exceptions");
  console.log("#246 BROWSER PASS: real Tesseract Italian OCR exact on original and manually corrected RAW-90 invoice; worker/WASM/ITA same origin, lazy load, two actual TXT downloads, 390px responsive, no external HTTP, no JS errors.");
  console.log("#246 OCR ASSET REQUESTS:", allRequests.filter((u) => u.includes("/ocr-246/")).map((u) => new URL(u).pathname).join(", "));
} finally {
  if (browser) await browser.close();
}
