/** #330 wave21 true PDF output, standalone producer and local Recents acceptance.
 * node tests/recent-pdf-page-numbers-330-wave21.browser.mjs
 * Desktop Chromium 390x844 only, no production or physical device claim.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.RECENT_PDF330_PORT ?? 18634);
const base = "http://127.0.0.1:" + port;
const toolId = "pdf-page-numbers";
const source = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
const replacement = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf"));
const secretName = "PRIVATE_PAGE_FILENAME_330.pdf";
const errors = [], unsafeRequests = [];

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" &&
      !(await indexedDB.databases()).some((item) => item.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("utility-workbench", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state", "readonly");
        const get = tx.objectStore("state").get("workbench/state:v1");
        get.onerror = () => reject(get.error);
        get.onsuccess = () => resolve(get.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}
async function expectCount(page, expected, timeoutMs = 8500) {
  const until = Date.now() + timeoutMs;
  let rows = [];
  do {
    rows = await recent(page);
    const matches = rows.filter((row) => row.toolId === toolId);
    if ((expected === 0 && matches.length === 0) ||
      (matches.length === 1 && matches[0].useCount === expected)) {
      if (expected) {
        assert.deepEqual(Object.keys(matches[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert.match(matches[0].lastUsedAt, /^\d{4}-\d\d-\d\dT/u);
        assert(Number.isFinite(Date.parse(matches[0].lastUsedAt)));
      }
      const serialized = JSON.stringify(rows);
      for (const forbidden of [secretName, "PRIVATE_", "alpha", "beta", "%PDF-", "pdf-numerato", "pageWidth"]) {
        assert(!serialized.includes(forbidden), "Private content persisted in Recents: " + forbidden);
      }
      return rows;
    }
    await new Promise((r) => setTimeout(r, 100));
  } while (Date.now() < until);
  assert.fail("Expected " + toolId + " count " + expected + ", observed " + JSON.stringify(rows));
}
async function readIndependentPdf(download, pages) {
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  const loader = getDocument({ data: new Uint8Array(bytes), disableAutoFetch: true,
    disableStream: true, useSystemFonts: true });
  try {
    const doc = await loader.promise;
    assert.equal(doc.numPages, pages);
    const texts = [];
    for (let number = 1; number <= pages; number++) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      texts.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
      page.cleanup();
    }
    return texts;
  } finally { await loader.destroy(); }
}
async function getDownloadedTexts(page, pages) {
  const wait = page.waitForEvent("download", { timeout: 25000 });
  await page.getByRole("link", { name: "Scarica PDF numerato" }).click();
  return readIndependentPdf(await wait, pages);
}
async function startServer() {
  const end = Date.now() + 50000;
  while (Date.now() < end) {
    try { if ((await fetch(base + "/tools/pdf-page-numbers/")).ok) return; }
    catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Local Astro pdf-page-numbers route not ready");
}
async function openRoute(page) {
  const response = await page.goto(base + "/tools/pdf-page-numbers/", { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((el) => !el.hasAttribute("ssr")), null, { timeout: 25000 });
}
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (r) => {
    if (!["GET", "HEAD"].includes(r.method())
      || !(r.url().startsWith(base) || r.url().startsWith("blob:") || r.url().startsWith("data:"))) {
      unsafeRequests.push(r.method() + " " + r.url());
    }
  });
}
async function holdNextFrame(page) {
  await page.evaluate(() => {
    window.__numberOriginalRaf = window.requestAnimationFrame;
    window.__numberHeld = [];
    window.requestAnimationFrame = (callback) => {
      window.__numberHeld.push(callback);
      return 99999;
    };
  });
}
async function releaseFrames(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = window.__numberOriginalRaf;
    const pending = window.__numberHeld.splice(0);
    for (const callback of pending) callback(performance.now());
  });
}
async function submitEvents(page, count) {
  await page.evaluate((times) => {
    const form = document.querySelector("[data-pdf-page-numbers]");
    for (let i = 0; i < times; i++) {
      if (form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))) {
        throw Error("Unprevented form submission");
      }
    }
  }, count);
}
const server = spawn("./node_modules/.bin/astro",
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, stdio: "ignore" });
let browser;
try {
  await startServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  watch(page);
  await openRoute(page);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px overflow");
  assert.deepEqual(await recent(page), []);
  assert(await page.getByRole("button", { name: "Applica numerazione" }).isDisabled());
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "bad.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF"),
  });
  await page.getByRole("alert").first().waitFor();
  assert(await page.getByRole("button", { name: "Applica numerazione" }).isDisabled());
  await expectCount(page, 0);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: secretName, mimeType: "application/pdf", buffer: source,
  });
  await page.locator("[data-number-plan]").waitFor({ timeout: 30000 });
  await page.getByLabel("Pagine da numerare").fill("3-1");
  assert(await page.getByRole("button", { name: "Applica numerazione" }).isDisabled());
  await expectCount(page, 0);
  await page.getByLabel("Pagine da numerare").fill("*");
  await page.getByLabel("Numero iniziale").fill("17");
  await submitEvents(page, 2);
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 30000 });
  const text = await getDownloadedTexts(page, 2);
  assert.match(text[0], /alpha/iu);
  assert.match(text[1], /beta/iu);
  assert.match(text[0], /\b17\b/u);
  assert.match(text[1], /\b18\b/u);
  await expectCount(page, 1); // genuine RED: original component never records
  await page.waitForTimeout(400);
  assert.equal((await recent(page)).find((row) => row.toolId === toolId)?.useCount, 1);

  // Deterministic pending RAF: mutate a real editable operator parameter.
  await holdNextFrame(page);
  await submitEvents(page, 1);
  await page.getByRole("button", { name: /Numerazione in corso/u }).waitFor();
  await page.getByLabel("Pagine da numerare").fill("9-6");
  await releaseFrames(page);
  await page.waitForTimeout(260);
  assert.equal(await page.getByRole("link", { name: "Scarica PDF numerato" }).count(), 0);
  assert.equal((await recent(page)).find((row) => row.toolId === toolId)?.useCount, 1);

  await page.getByLabel("Pagine da numerare").fill("*");
  await holdNextFrame(page);
  await submitEvents(page, 1);
  await page.getByRole("button", { name: "Annulla numerazione" }).click();
  await releaseFrames(page);
  await page.waitForTimeout(230);
  assert.equal(await page.getByRole("link", { name: "Scarica PDF numerato" }).count(), 0);
  assert.equal((await recent(page)).find((row) => row.toolId === toolId)?.useCount, 1);

  await holdNextFrame(page);
  await submitEvents(page, 1);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "PRIVATE_REPLACED_SOURCE_330.pdf", mimeType: "application/pdf", buffer: replacement,
  });
  await releaseFrames(page);
  await page.waitForTimeout(240);
  assert.equal(await page.getByRole("link", { name: "Scarica PDF numerato" }).count(), 0);
  assert.equal((await recent(page)).find((row) => row.toolId === toolId)?.useCount, 1);
  await page.locator("[data-number-plan]").waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Applica numerazione" }).click();
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 30000 });
  assert.equal((await getDownloadedTexts(page, 3)).length, 3);
  await expectCount(page, 2);
  await page.goto(base + "/preferiti/", { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /PDF|numerazione/iu);
  await page.reload({ waitUntil: "networkidle" });
  await expectCount(page, 2);
  assert.deepEqual(errors, [], "Uncaught browser errors");
  assert.deepEqual(unsafeRequests, [], "Unexpected POST/offsite requests");
  await context.close();
  console.log("PASS #330 wave21: PDF.js independently parsed genuine PDF bytes, successful count 1→2, synchronous duplicate once, invalid/cancel/changed params+file zero, IDB canonical metadata only, Favoriti reload, 390px zero POST/offsite.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
