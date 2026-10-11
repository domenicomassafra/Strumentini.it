/** #341 real browser: explicit save -> readback -> reload/reopen -> scoped delete. */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { createSimplePdf } from "../src/engines/pdf/writer.ts";

const port = 19441;
const origin = process.env.PDF341_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.PDF341_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* local server */ }
    if (server?.exitCode != null) throw new Error("Astro startup failed");
    if (i === 79) throw new Error("Astro server unavailable");
    await sleep(250);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errorEvents = [];
  const nonGetRequests = [];
  page.on("pageerror", (error) => errorEvents.push(error.message));
  page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) nonGetRequests.push(request.url()); });
  assert.equal((await page.goto(`${origin}/tools/pdf-merge/`, { waitUntil: "networkidle" }))?.status(), 200);
  const pdfA = Buffer.from(createSimplePdf(["LOCAL341_A"]));
  const pdfB = Buffer.from(createSimplePdf(["LOCAL341_B"]));
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: pdfA },
    { name: "b.pdf", mimeType: "application/pdf", buffer: pdfB },
  ]);
  await page.getByRole("button", { name: "Unisci PDF", exact: true }).click();
  const save = page.locator("[data-saved-pdf341-save] button");
  await save.waitFor({ state: "visible" });
  const preservedOutputDownload = await page.locator(".result-panel").innerText();
  assert(preservedOutputDownload.includes("Scarica"));
  const list = page.locator("[data-saved-pdf341-list] > li");
  assert.equal(await list.count(), 0);
  const outputDownloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Scarica merged.pdf" }).click();
  const originalDownload = await outputDownloadPromise;
  const originalBytes = await readFile(await originalDownload.path());
  await save.click();
  await list.first().waitFor({ state: "visible" });
  assert.equal(await list.count(), 1);
  assert((await page.locator("[data-saved-pdf341-status]").innerText()).includes("conservato"));
  assert.equal(nonGetRequests.length, 0, "saving exact PDF bytes must not POST anywhere");

  // Bounded voluntary storage: a sixth save must refuse without deleting the
  // five records or the successfully generated downloadable PDF.
  for (let n = 2; n <= 5; n++) {
    await save.click();
    await page.waitForFunction((count) => document.querySelectorAll("[data-saved-pdf341-list] > li").length === count, n);
  }
  assert.equal(await list.count(), 5);
  await save.click();
  await page.getByText("Impossibile conservare il PDF", { exact: false }).waitFor();
  assert.equal(await list.count(), 5, "full quota cannot evict an unrelated saved file");
  assert((await page.locator(".result-panel").innerText()).includes("Scarica"));

  await page.reload({ waitUntil: "networkidle" });
  await list.first().waitFor({ state: "visible" });
  assert.equal(await list.count(), 5);
  assert.equal(await save.count(), 0, "reloading doesn't pretend a previous operation/result survived");
  await page.getByRole("button", { name: "Riapri come input" }).first().click();
  await page.getByText(/PDF conservato riaperto come input/u).waitFor();
  assert.equal(await page.locator('input[type="file"]').first().evaluate((input) => input.files?.length ?? -1), 0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica PDF conservato" }).first().click();
  const fileDownload = await downloadPromise;
  assert.equal(fileDownload.suggestedFilename(), "merged.pdf");
  assert.deepEqual(await readFile(await fileDownload.path()), originalBytes, "stored PDF must survive save/reload/reopen with identical bytes");

  // Simulate browser data corruption without deleting any record. One saved
  // entry has the right shape but the wrong checksum, another is malformed.
  // Other native PDFs must remain reachable without a hidden repair/purge.
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("strumentini-optin-pdf-341", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("pdf", "readwrite");
        const get = tx.objectStore("pdf").getAll();
        get.onsuccess = () => {
          const [first, second] = get.result;
          first.bytes[10] ^= 1;
          tx.objectStore("pdf").put(first);
          tx.objectStore("pdf").put({ ...second, bytes: new Uint8Array([1]) });
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll("[data-saved-pdf341-list] > li").length === 3);
  assert.equal(await list.count(), 3, "damaged entries must not mask or purge the three good PDFs");
  assert.match(await page.locator("[data-saved-pdf341-status]").innerText(), /2.*(danneggiat|non leggibil)/iu);
  const recoveredDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica PDF conservato" }).first().click();
  assert.deepEqual(await readFile(await (await recoveredDownloadPromise).path()), originalBytes);
  assert.equal(await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("strumentini-optin-pdf-341", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("pdf", "readonly");
        const req = tx.objectStore("pdf").count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally { db.close(); }
  }), 5, "listing and recovery must never silently remove corrupt or good records");

  page.on("dialog", (dialog) => { void dialog.accept(); });
  await page.getByRole("button", { name: "Elimina PDF conservato" }).first().click();
  await page.waitForFunction(() => document.querySelectorAll("[data-saved-pdf341-list] > li").length === 2);
  assert.equal(await list.count(), 2, "deleting one good PDF must preserve the others");
  for (let remaining = 2; remaining > 0; remaining--) {
    await page.getByRole("button", { name: "Elimina PDF conservato" }).first().click();
    await page.waitForFunction((count) => document.querySelectorAll("[data-saved-pdf341-list] > li").length === count || count === 0 && !!document.querySelector("[data-saved-pdf341-empty]"), remaining - 1);
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-saved-pdf341-empty]").waitFor({ state: "visible" });
  assert.match(await page.locator("[data-saved-pdf341-status]").innerText(), /2.*(danneggiat|non leggibil)/iu);

  // An anomalous sixth database row must not trigger unbounded digest work,
  // falsely claim a complete list, or silently delete anything.
  await page.evaluate(async (original) => {
    const bytes = new Uint8Array(original);
    const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const sha256 = Array.from(hashBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("strumentini-optin-pdf-341", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("pdf", "readwrite");
        for (let i = 0; i < 4; i++) tx.objectStore("pdf").add({
          id: crypto.randomUUID(), schemaVersion: 1, mime: "application/pdf",
          name: "recovered341.pdf", byteLength: bytes.byteLength, bytes,
          sha256, createdAt: new Date().toISOString(),
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, Array.from(originalBytes));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/Archivio oltre i limiti di 5 file/iu).waitFor();
  assert(await list.count() > 0 && await list.count() <= 5, "overflow inventory remains bounded and explicitly partial");
  const overflowDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica PDF conservato" }).first().click();
  assert.deepEqual(await readFile(await (await overflowDownloadPromise).path()), originalBytes);
  assert.deepEqual(errorEvents, []);
  assert.equal(nonGetRequests.length, 0);

  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await deniedContext.addInitScript(() => {
    const originalOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, version) {
      if (name === "strumentini-optin-pdf-341") throw new DOMException("storage denied", "SecurityError");
      return version === undefined ? originalOpen.call(this, name) : originalOpen.call(this, name, version);
    };
  });
  const denied = await deniedContext.newPage();
  await denied.goto(`${origin}/tools/pdf-merge/`, { waitUntil: "networkidle" });
  await denied.locator('input[type="file"]').first().setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: pdfA },
    { name: "b.pdf", mimeType: "application/pdf", buffer: pdfB },
  ]);
  await denied.getByRole("button", { name: "Unisci PDF", exact: true }).click();
  const deniedSave = denied.locator("[data-saved-pdf341-save] button");
  await deniedSave.waitFor({ state: "visible" });
  await deniedSave.click();
  await denied.getByText("Impossibile conservare il PDF", { exact: false }).waitFor();
  assert((await denied.locator(".result-panel").innerText()).includes("Scarica"));
  await deniedContext.close();

  // Browser eviction after successful consent must not take away the current
  // generated result or trigger a replacement download without an explicit click.
  const evictedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const evicted = await evictedContext.newPage();
  let unexpectedDownloads = 0;
  evicted.on("download", () => { unexpectedDownloads++; });
  await evicted.goto(`${origin}/tools/pdf-merge/`, { waitUntil: "networkidle" });
  await evicted.locator('input[type="file"]').first().setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: pdfA },
    { name: "b.pdf", mimeType: "application/pdf", buffer: pdfB },
  ]);
  await evicted.getByRole("button", { name: "Unisci PDF", exact: true }).click();
  await evicted.locator("[data-saved-pdf341-save] button").click();
  await evicted.locator("[data-saved-pdf341-list] > li").first().waitFor();
  await evicted.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase("strumentini-optin-pdf-341");
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  });
  assert.equal(unexpectedDownloads, 0, "save and storage eviction cannot start retroactive downloads");
  const evictedDownloadPromise = evicted.waitForEvent("download");
  await evicted.getByRole("link", { name: "Scarica merged.pdf" }).click();
  assert.deepEqual(await readFile(await (await evictedDownloadPromise).path()), originalBytes);
  await evicted.reload({ waitUntil: "networkidle" });
  await evicted.locator("[data-saved-pdf341-empty]").waitFor();
  await evictedContext.close();
  await browser.close();
  browser = undefined;
  console.log("#341 local Chromium PASS: exact output/download/reload bytes; five-record quota and one-item deletion; two corrupted rows isolated, intact rows recovered; overflow bounded and warned; denied/evicted IDB preserves manual download; no retro download; zero POST");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
