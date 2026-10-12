/** #330 wave22: independently parsed downloadable watermark + success-only Recenti.
 * Run: node tests/recent-pdf-watermark-330-wave22.browser.mjs
 * Real desktop Chrome 390px; no real iOS/Android, provider or public upload.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.WATERMARK330_PORT ?? 18635);
const origin = `http://127.0.0.1:${port}`;
const id = "pdf-watermark";
const source = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
const replacement = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf"));
const privateName = "PRIVATE_PDF_WM330_SOURCE.pdf";
const watermark = "WAVE22MARK";
const errors = [];
const requests = [];

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" &&
      !(await indexedDB.databases()).some((item) => item.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("utility-workbench", 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state", "readonly");
        const item = tx.objectStore("state").get("workbench/state:v1");
        item.onsuccess = () => resolve(item.result?.recent ?? []);
        item.onerror = () => reject(item.error);
        tx.oncomplete = () => db.close();
      };
    });
  });
}
async function count(page, expected, timeout = 8000) {
  const limit = Date.now() + timeout;
  let rows = [];
  do {
    rows = await recent(page);
    const match = rows.filter((entry) => entry.toolId === id);
    if ((expected === 0 && match.length === 0) || (match.length === 1 && match[0].useCount === expected)) {
      if (expected !== 0) {
        assert.deepEqual(Object.keys(match[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(Number.isFinite(Date.parse(match[0].lastUsedAt)));
      }
      const data = JSON.stringify(rows);
      for (const value of ["PRIVATE_", privateName, watermark, "alpha", "beta", "%PDF", "pdf-filigranato"]) {
        assert(!data.includes(value), `private PDF content persisted: ${value}`);
      }
      return rows;
    }
    await new Promise((done) => setTimeout(done, 75));
  } while (Date.now() < limit);
  throw Error(`Expected watermark Recenti count ${expected}, got ${JSON.stringify(rows)}`);
}
function inspectPdfIndependently(path, expectedPages, expectedWatermarked, originalTokens) {
  const program = `import json,sys
from pypdf import PdfReader
r=PdfReader(sys.argv[1], strict=True)
print(json.dumps({"pages":len(r.pages),"texts":[p.extract_text() or "" for p in r.pages],
  "contentBytes":[len(p.get_contents().get_data()) for p in r.pages]}))`;
  const result = spawnSync("python3", ["-c", program, path], { encoding: "utf8", timeout: 12000 });
  assert.equal(result.status, 0, `independent pypdf parse failed ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.pages, expectedPages, "independently parsed real PDF pages mismatch");
  assert.equal(parsed.texts.length, expectedPages);
  for (const [i, expected] of originalTokens.entries()) {
    assert(parsed.texts[i]?.includes(expected), `original PDF text missing page ${i + 1}`);
    assert.equal(parsed.texts[i].includes(watermark), expectedWatermarked.includes(i + 1),
      `watermark content missing/wrong page ${i + 1}: ${JSON.stringify(parsed.texts[i])}`);
  }
  return parsed;
}
async function getOutput(page, pages, selected, tokens) {
  const event = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("link", { name: "Scarica PDF con filigrana" }).click();
  const download = await event;
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  const details = inspectPdfIndependently(await download.path(), pages, selected, tokens);
  return { bytes: bytes.length, details };
}
async function ready() {
  for (let t = 0; t < 160; t++) {
    try { if ((await fetch(origin + "/tools/pdf-watermark/")).ok) return; } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw Error("Local Astro watermark dev server did not become ready");
}
async function openTool(page) {
  const response = await page.goto(origin + "/tools/pdf-watermark/", { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((item) => !item.hasAttribute("ssr")), null, { timeout: 25000 });
}
async function dispatchSubmits(page, times) {
  await page.evaluate((n) => {
    const form = document.querySelector("[data-pdf-watermark]");
    for (let i = 0; i < n; i++) {
      if (form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))) {
        throw Error("Unprevented native form submit");
      }
    }
  }, times);
}
async function holdFrame(page) {
  await page.evaluate(() => {
    window.__watermarkRaf = window.requestAnimationFrame;
    window.__watermarkFrames = [];
    window.requestAnimationFrame = (callback) => { window.__watermarkFrames.push(callback); return 424242; };
  });
}
async function releaseFrames(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = window.__watermarkRaf;
    for (const callback of window.__watermarkFrames.splice(0)) callback(performance.now());
  });
}
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (![ "GET", "HEAD" ].includes(request.method())
      || !(url.startsWith(origin) || url.startsWith("blob:") || url.startsWith("data:"))) {
      requests.push(request.method() + " " + url);
    }
  });
}

const server = spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: root, stdio: "ignore" });
let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  watch(page);
  await openTool(page);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  await count(page, 0);
  assert(await page.getByRole("button", { name: "Applica filigrana" }).isDisabled());

  await page.locator('[data-pdf-watermark] input[type="file"]').first().setInputFiles({
    name: privateName, mimeType: "application/pdf", buffer: Buffer.from("not a real PDF"),
  });
  await page.getByRole("alert").first().waitFor();
  await count(page, 0);

  await page.locator('[data-pdf-watermark] input[type="file"]').first().setInputFiles({
    name: privateName, mimeType: "application/pdf", buffer: source,
  });
  await page.locator("[data-watermark-plan]").waitFor({ timeout: 30000 });
  await page.locator('label:has(> span:text-is("Pagine")) input').fill("3-1");
  assert(await page.getByRole("button", { name: "Applica filigrana" }).isDisabled());
  await count(page, 0);
  await page.locator('label:has(> span:text-is("Pagine")) input').fill("2");
  await page.locator('label:has(> span:text-is("Testo filigrana")) input').fill(watermark);
  await page.locator('label:has(> span:text-is("Rotazione (gradi)")) input').fill("0");

  await dispatchSubmits(page, 2);
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 25000 });
  const first = await getOutput(page, 2, [2], ["alpha", "beta"]);
  assert(first.bytes > source.length, "watermarked result not a genuine expanded PDF");
  await count(page, 1); // genuine RED: standalone Watermark producer omits Recenti
  await page.waitForTimeout(250);
  assert.equal((await recent(page)).find((entry) => entry.toolId === id)?.useCount, 1, "duplicate counted");

  await holdFrame(page);
  await dispatchSubmits(page, 1);
  await page.getByRole("button", { name: "Annulla filigrana" }).click();
  await releaseFrames(page);
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole("link", { name: "Scarica PDF con filigrana" }).count(), 0);
  await count(page, 1);

  await holdFrame(page);
  await dispatchSubmits(page, 1);
  await page.locator('label:has(> span:text-is("Pagine")) input').fill("9-1");
  await releaseFrames(page);
  await page.waitForTimeout(120);
  assert.equal(await page.getByRole("link", { name: "Scarica PDF con filigrana" }).count(), 0);
  await count(page, 1);

  await page.locator('label:has(> span:text-is("Pagine")) input').fill("*");
  await holdFrame(page);
  await dispatchSubmits(page, 1);
  await page.locator('[data-pdf-watermark] input[type="file"]').first().setInputFiles({
    name: "PRIVATE_PDF_WM330_REPLACEMENT.pdf", mimeType: "application/pdf", buffer: replacement,
  });
  await releaseFrames(page);
  await page.waitForTimeout(120);
  assert.equal(await page.getByRole("link", { name: "Scarica PDF con filigrana" }).count(), 0);
  await count(page, 1);
  await page.locator("[data-watermark-plan]").waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Applica filigrana" }).click();
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 25000 });
  const second = await getOutput(page, 3, [1, 2, 3], ["one", "two", "three"]);
  await count(page, 2);
  await page.goto(origin + "/preferiti/", { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor({ timeout: 20000 });
  assert.match(await page.locator("[data-area-activity]").innerText(), /Watermark|filigrana/iu);
  await page.reload({ waitUntil: "networkidle" });
  await count(page, 2);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, [], "Offsite or non-read-only request");
  await context.close();

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await denied.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } });
  });
  const blocked = await denied.newPage();
  watch(blocked);
  await openTool(blocked);
  await blocked.locator('[data-pdf-watermark] input[type="file"]').first().setInputFiles({
    name: "PRIVATE_DENIED.pdf", mimeType: "application/pdf", buffer: source,
  });
  await blocked.locator("[data-watermark-plan]").waitFor({ timeout: 20000 });
  await blocked.locator('label:has(> span:text-is("Testo filigrana")) input').fill(watermark);
  await blocked.getByRole("button", { name: "Applica filigrana" }).click();
  await blocked.locator('.result-panel[data-state="success"]').waitFor({ timeout: 20000 });
  await getOutput(blocked, 2, [1, 2], ["alpha", "beta"]);
  await blocked.goto(origin + "/preferiti/", { waitUntil: "networkidle" });
  assert.match(await blocked.locator("body").innerText(), /memoria|browser|temporane|disponibil/iu);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  await denied.close();
  console.log("PASS #330 watermark real Chrome 390; pypdf actual output", JSON.stringify({
    firstPdfBytes: first.bytes, secondPdfBytes: second.bytes, recentCount: 2,
    doubleSubmit: "once", invalidCancelStale: "zero", indexedDbDenied: "local success",
    privacy: "canonical metadata only", offsiteWrites: 0,
  }));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
