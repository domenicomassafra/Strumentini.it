/**
 * #342 independent compiled-static-browser acceptance (390px Chromium):
 * consent vs transient result, five-file and 24 MiB quotas, corrupt/orphan
 * non-deletion, explicit scoped deletion, denied/evicted storage, manual output.
 * Run against existing compiled preview:
 *   PDF342_ORIGIN=http://127.0.0.1:19541 node tests/acceptance-local-quota-342.browser.mjs
 * Or omit PDF342_ORIGIN to serve the ALREADY built ./dist (never rebuild).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { createSimplePdf } from "../src/engines/pdf/writer.ts";

const DB = "strumentini-optin-pdf-341";
const MAX_TOTAL = 24 * 1024 * 1024;
const MAX_SINGLE = 8 * 1024 * 1024;
const port = process.env.PDF342_ORIGIN ? null : await new Promise((resolve, reject) => {
  const socket = createServer();
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    if (typeof address === "string" || !address) { reject(new Error("No local TCP port")); return; }
    socket.close(() => resolve(address.port));
  });
});
const origin = process.env.PDF342_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = port === null ? null : spawn("python3", ["-m", "http.server", `${port}`, "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: process.cwd(), stdio: "ignore",
});
const inputs = ["#342 source A", "#342 source B"].map((text, i) => ({
  name: `quota342-${i}.pdf`, mimeType: "application/pdf", buffer: Buffer.from(createSimplePdf([text])),
}));

/** Read raw persisted bytes; an app inventory is deliberately insufficient for orphan proof. */
async function rawInventory(page) {
  return await page.evaluate(async (name) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("pdf", "readonly");
        const request = tx.objectStore("pdf").getAll();
        request.onsuccess = () => resolve(request.result.map((record) => ({
          id: record.id, name: record.name, bytes: record.bytes?.byteLength,
          checksum: record.sha256, version: record.schemaVersion,
        })).sort((a, b) => a.id.localeCompare(b.id)));
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, DB);
}

async function initPage(context, route = "/tools/pdf-merge/") {
  const page = await context.newPage();
  assert.equal((await page.goto(`${origin}${route}`, { waitUntil: "networkidle" }))?.status(), 200);
  await page.locator("[data-saved-pdf341]").waitFor();
  return page;
}

async function producePdf(page) {
  await page.locator('input[type="file"]').first().setInputFiles(inputs);
  await page.getByRole("button", { name: "Unisci PDF", exact: true }).click();
  await page.locator("[data-saved-pdf341-save] button").waitFor({ state: "visible", timeout: 30_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Scarica merged.pdf" }).click();
  return readFile(await (await downloadPromise).path());
}

async function saveOne(page, expectedCount) {
  await page.locator("[data-saved-pdf341-save] button").click();
  await page.waitForFunction((count) => document.querySelectorAll("[data-saved-pdf341-list] > li").length === count, expectedCount);
  assert.match(await page.locator("[data-saved-pdf341-status]").innerText(), /PDF conservato su questo dispositivo/u);
}

let browser;
try {
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if ((await fetch(`${origin}/tools/pdf-merge/`, { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* startup */ }
    if (server?.exitCode != null) throw new Error(`Compiled static server exited ${server.exitCode}`);
    if (attempt === 89) throw new Error("Compiled static preview not ready");
    await sleep(180);
  }
  browser = await chromium.launch({ headless: true });
  const errors = [], outbound = [], downloads = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  context.on("page", (page) => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("download", (item) => downloads.push(item.suggestedFilename()));
  });
  context.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) outbound.push(request.url());
  });
  const page = await initPage(context);
  const saved = page.locator("[data-saved-pdf341-list] > li");
  const original = await producePdf(page);
  assert.equal(await saved.count(), 0, "a transient generated PDF is NOT persisted without consent");
  assert.match(await page.locator("[data-saved-pdf341]").innerText(), /Nessun PDF conservato volontariamente/u);
  assert.match(await page.locator("[data-saved-pdf341-save]").innerText(), /Conserva volontariamente/u);
  await saveOne(page, 1);
  await saveOne(page, 2);
  await saveOne(page, 3);
  const beforeDeletion = await rawInventory(page);
  assert.equal(beforeDeletion.length, 3);
  assert(beforeDeletion.every((item) => item.bytes === original.byteLength), "stored bytes must be exact");
  await page.reload({ waitUntil: "networkidle" });
  await saved.first().waitFor();
  assert.equal(await saved.count(), 3);
  assert.equal(await page.locator("[data-saved-pdf341-save] button").count(), 0, "transient result must disappear on reload");
  assert.equal(await page.getByRole("button", { name: "Scarica PDF conservato" }).count(), 3);
  const persistedDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica PDF conservato" }).first().click();
  assert.deepEqual(await readFile(await (await persistedDownload).path()), original);

  // Cancellation of the *delete confirmation* changes none of the raw records.
  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.getByRole("button", { name: "Elimina PDF conservato" }).first().click();
  assert.deepEqual(await rawInventory(page), beforeDeletion);
  const chosenName = (await saved.first().innerText()).split(" (")[0];
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Elimina PDF conservato" }).first().click();
  await page.waitForFunction(() => document.querySelectorAll("[data-saved-pdf341-list] > li").length === 2);
  const afterDeletion = await rawInventory(page);
  assert.equal(afterDeletion.length, 2);
  assert(afterDeletion.every((record) => beforeDeletion.some((originalRecord) =>
    originalRecord.id === record.id && originalRecord.checksum === record.checksum)));
  assert.equal(beforeDeletion.filter((record) => afterDeletion.some((remaining) => remaining.id === record.id)).length, 2);

  // An unsupported old row / damaged hash must remain as an orphan until an
  // explicit user action. A failed save is atomic and NEVER purges its siblings.
  const damaged = await page.evaluate(async (name) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("pdf", "readwrite");
        const request = tx.objectStore("pdf").getAll();
        let damagedId;
        request.onsuccess = () => {
          const damaged = request.result[0];
          damagedId = damaged.id;
          tx.objectStore("pdf").put({ ...damaged, schemaVersion: 0 });
        };
        tx.oncomplete = () => resolve(damagedId);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, DB);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-saved-pdf341-status]").getByText(/1 PDF locali non leggibili/iu).waitFor();
  assert.equal(await saved.count(), 1);
  const corruptBefore = await rawInventory(page);
  assert.equal(corruptBefore.length, 2, "UI does not remove invisible/orphan records");
  assert(corruptBefore.some((item) => item.id === damaged && item.version === 0));
  await producePdf(page);
  await page.locator("[data-saved-pdf341-save] button").click();
  await page.getByText(/Impossibile conservare il PDF/iu).waitFor();
  assert.deepEqual(await rawInventory(page), corruptBefore, "failed migration/corruption must never delete valid or orphaned rows");
  assert.equal(await saved.count(), 1);

  // Five-slot quota: reject sixth without silently evicting any full-store entry.
  const quotaContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const quotaPage = await initPage(quotaContext);
  const quotaOriginal = await producePdf(quotaPage);
  for (let count = 1; count <= 5; count++) await saveOne(quotaPage, count);
  const fullFive = await rawInventory(quotaPage);
  assert.equal(fullFive.length, 5);
  await quotaPage.locator("[data-saved-pdf341-save] button").click();
  await quotaPage.getByText(/Impossibile conservare il PDF/iu).waitFor();
  assert.deepEqual(await rawInventory(quotaPage), fullFive);
  assert.equal(await quotaPage.locator("[data-saved-pdf341-list] > li").count(), 5);
  const retainedTransient = quotaPage.waitForEvent("download");
  await quotaPage.getByRole("link", { name: "Scarica merged.pdf" }).click();
  assert.deepEqual(await readFile(await (await retainedTransient).path()), quotaOriginal);
  await quotaPage.reload({ waitUntil: "networkidle" });
  assert.equal(await quotaPage.locator("[data-saved-pdf341-list] > li").count(), 5);
  assert.deepEqual(await rawInventory(quotaPage), fullFive);
  await quotaContext.close();

  // Independent 24 MiB total bound: 3 synthetic schema-valid 8 MiB fixtures
  // inserted directly into IDB (not falsely labelled real generated PDFs).
  const bytesContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const bytesPage = await initPage(bytesContext);
  await bytesPage.evaluate(async ({ name, single }) => {
    const bytes = new Uint8Array(single);
    bytes.set(new TextEncoder().encode("%PDF-1.4\n"), 0);
    bytes.set(new TextEncoder().encode("\n%%EOF\n"), single - 7);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("pdf", "readwrite");
        for (let i = 0; i < 3; i++) tx.objectStore("pdf").add({
          schemaVersion: 1, id: crypto.randomUUID(), name: `quota342-fixture-${i}.pdf`,
          mime: "application/pdf", byteLength: bytes.length, bytes, sha256: hash,
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, { name: DB, single: MAX_SINGLE });
  await bytesPage.reload({ waitUntil: "networkidle" });
  await bytesPage.waitForFunction(() => document.querySelectorAll("[data-saved-pdf341-list] > li").length === 3);
  const fullBytes = await rawInventory(bytesPage);
  assert.equal(fullBytes.reduce((sum, item) => sum + item.bytes, 0), MAX_TOTAL);
  const transientWithFullBytes = await producePdf(bytesPage);
  await bytesPage.locator("[data-saved-pdf341-save] button").click();
  await bytesPage.getByText(/Impossibile conservare il PDF/iu).waitFor();
  assert.deepEqual(await rawInventory(bytesPage), fullBytes, "24MiB full must not silently evict any item");
  const manualWithFullBytes = bytesPage.waitForEvent("download");
  await bytesPage.getByRole("link", { name: "Scarica merged.pdf" }).click();
  assert.deepEqual(await readFile(await (await manualWithFullBytes).path()), transientWithFullBytes);
  await bytesContext.close();

  // Denial: current manual download stays usable even if IDB API refuses open.
  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await deniedContext.addInitScript((name) => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (database, version) {
      if (database === name) throw new DOMException("denied by privacy policy", "SecurityError");
      return version === undefined ? original.call(this, database) : original.call(this, database, version);
    };
  }, DB);
  const deniedPage = await initPage(deniedContext);
  await deniedPage.getByText(/Archivio PDF locale non disponibile/iu).waitFor();
  const deniedOriginal = await producePdf(deniedPage);
  await deniedPage.locator("[data-saved-pdf341-save] button").click();
  await deniedPage.getByText(/Impossibile conservare il PDF/iu).waitFor();
  const deniedManual = deniedPage.waitForEvent("download");
  await deniedPage.getByRole("link", { name: "Scarica merged.pdf" }).click();
  assert.deepEqual(await readFile(await (await deniedManual).path()), deniedOriginal);
  await deniedContext.close();

  // Eviction: simulate the browser deleting IndexedDB after explicit consent.
  const evictionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const evictionPage = await initPage(evictionContext);
  const evictionOriginal = await producePdf(evictionPage);
  await saveOne(evictionPage, 1);
  const downloadsBeforeEviction = downloads.length;
  await evictionPage.evaluate(async (name) => await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Eviction blocked by open IndexedDB connections"));
  }), DB);
  assert.equal(downloads.length, downloadsBeforeEviction, "eviction must not auto-download an old result");
  const evictionManual = evictionPage.waitForEvent("download");
  await evictionPage.getByRole("link", { name: "Scarica merged.pdf" }).click();
  assert.deepEqual(await readFile(await (await evictionManual).path()), evictionOriginal);
  await evictionPage.reload({ waitUntil: "networkidle" });
  await evictionPage.locator("[data-saved-pdf341-empty]").waitFor();
  assert.equal(await evictionPage.locator("[data-saved-pdf341-save] button").count(), 0);
  assert.equal(await evictionPage.getByRole("button", { name: "Scarica PDF conservato" }).count(), 0);
  await evictionContext.close();

  assert.deepEqual(errors, [], "no uncaught browser errors in user-facing route");
  assert.deepEqual(outbound, [], "no uploads or state-changing HTTP requests during local PDF operations");
  assert(chosenName.includes("merged.pdf"));
  await context.close();
  console.log("#342 compiled-static Chromium 390px PASS: transient/saved UI, 5 files+24MiB, scoped delete, corrupt-orphan no purge, storage denied+evicted, byte-exact manual downloads; zero non-GET requests; physical Safari NOT_RUN");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
