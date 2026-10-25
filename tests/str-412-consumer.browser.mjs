/** STR-412: compiled PDF consumer, migration, add-only saves and reload/crash restore. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const port = Number(process.env.STR412_PORT ?? 18474);
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser;
let context;

async function ready() {
  for (let n = 0; n < 120; n++) {
    if (server.exitCode !== null) throw new Error("Compiled consumer did not start");
    try { if ((await fetch(origin + "/tools/pdf-page-reorder/")).status === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Compiled PDF route unavailable");
}
async function hydrated(page) {
  await page.waitForFunction(() => {
    const islands = Array.from(document.querySelectorAll("astro-island"));
    return islands.length > 0 && islands.every((island) => !island.hasAttribute("ssr"));
  }, null, { timeout: 30000 });
}
async function records(page) {
  return page.evaluate(async () => {
    async function open(database, version) {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(database, version);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    async function read(db, store) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      });
    }
    const legacyDb = await open("strumentini-optin-pdf-341", 2);
    const versionedDb = await open("strumentini-editor-projects-412", 1);
    try {
      const digest = async (bytes) => {
        const result = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
        return Array.from(new Uint8Array(result), (n) => n.toString(16).padStart(2, "0")).join("");
      };
      const legacy = await Promise.all((await read(legacyDb, "projects")).map(async (entry) => ({
        id: entry.id, schemaVersion: entry.schemaVersion, hash: await digest(entry.bytes),
      })));
      const versioned = await Promise.all((await read(versionedDb, "state"))
        .filter((entry) => entry?.kind === "pdf" || entry?.version >= 2)
        .map(async (entry) => ({
          id: entry.id, version: entry.version, hash: await digest(entry.files[0].bytes),
        })));
      return { legacy, versioned };
    } finally { legacyDb.close(); versionedDb.close(); }
  });
}

try {
  await ready();
  browser = process.env.STR412_BROWSER_MODE === "cdp"
    ? await chromium.connectOverCDP("http://127.0.0.1:17629", { timeout: 30000 })
    : await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const offsite = [];
  const errors = [];
  context.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) offsite.push(url);
  });
  context.on("page", (tab) => tab.on("pageerror", (error) => errors.push(error.message)));
  const pdf = await PDFDocument.create();
  pdf.addPage([301, 420]);
  pdf.addPage([302, 420]);
  const input = Buffer.from(await pdf.save({ useObjectStreams: false }));
  const expectedHash = createHash("sha256").update(input).digest("hex");
  let page = await context.newPage();
  assert.equal((await page.goto(origin + "/tools/pdf-page-reorder/"))?.status(), 200);
  await hydrated(page);
  await page.getByLabel("PDF da modificare").setInputFiles({ name: "original412.pdf", mimeType: "application/pdf", buffer: input });
  let order = page.locator("[data-pdf-order-status]");
  await order.filter({ hasText: /2 pagine/u }).waitFor();
  await page.getByRole("button", { name: "Inverti ordine" }).click();
  await order.filter({ hasText: /2, 1/u }).waitFor();
  // Existing v1 app remains usable; migrate from the real persisted IDB record.
  await page.getByRole("button", { name: "Salva copia del progetto su questo dispositivo" }).click();
  await page.locator("[data-pdf-project-message]").getByText(/SHA-256 verificato/u).waitFor();
  const legacy = (await records(page)).legacy;
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].schemaVersion, 1);
  assert.equal(legacy[0].hash, expectedHash);
  await page.getByRole("button", { name: "Migra progetto v1 selezionato a v2" }).click();
  await page.locator("[data-pdf-project-412-message]").getByText(/migrato a v2/u).waitFor();
  let inventory = await records(page);
  assert.equal(inventory.versioned.length, 1);
  assert.equal(inventory.versioned[0].id, legacy[0].id);
  assert.equal(inventory.versioned[0].version, 2);
  assert.equal(inventory.versioned[0].hash, expectedHash);
  assert.equal(inventory.legacy[0].hash, expectedHash);
  await page.getByRole("button", { name: "Migra progetto v1 selezionato a v2" }).click();
  await page.locator("[data-pdf-project-412-message]").getByText(/ALREADY_EXISTS/u).waitFor();
  assert.equal((await records(page)).versioned.length, 1, "ID collision must not overwrite existing snapshot");
  await page.getByRole("button", { name: "Salva progetto PDF v2" }).click();
  await page.locator("[data-pdf-project-412-message]").getByText(/v2 salvato/u).waitFor();
  assert.equal((await records(page)).versioned.length, 2);

  // Simulate a crashed tab; IndexedDB must survive and restore v1->v2 history.
  await page.close();
  page = await context.newPage();
  assert.equal((await page.goto(origin + "/tools/pdf-page-reorder/"))?.status(), 200);
  await hydrated(page);
  order = page.locator("[data-pdf-order-status]");
  const choices = page.getByLabel("Progetto PDF versione 2");
  await choices.selectOption(legacy[0].id);
  await page.getByRole("button", { name: "Riprendi progetto v2" }).click();
  await order.filter({ hasText: /2, 1/u }).waitFor();
  await page.getByRole("button", { name: "Annulla modifica" }).click();
  await order.filter({ hasText: /1, 2/u }).waitFor();
  await page.getByRole("button", { name: "Ripristina modifica" }).click();
  await order.filter({ hasText: /2, 1/u }).waitFor();

  // Abort IndexedDB's insert, then prove no old record disappeared or changed.
  await page.evaluate(() => {
    const previous = IDBObjectStore.prototype.add;
    window.__str412Add = previous;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "state") { this.transaction.abort(); return previous.apply(this, args); }
      return previous.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Salva progetto PDF v2" }).click();
  await page.locator("[data-pdf-project-412-message]").getByText(/Salvataggio v2 rifiutato/u).waitFor();
  inventory = await records(page);
  assert.equal(inventory.versioned.length, 2);
  assert.equal(inventory.legacy[0].hash, expectedHash);
  await page.evaluate(() => {
    IDBObjectStore.prototype.add = window.__str412Add;
    delete window.__str412Add;
  });

  // Future schema refuses to restore, leaving the current PDF displayed.
  await page.evaluate(async (id) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("strumentini-editor-projects-412", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const key = "editor-project/412/v2/" + id;
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state");
        const req = store.get(key);
        req.onsuccess = () => store.put({ ...req.result, version: 99 }, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, legacy[0].id);
  await page.reload();
  await hydrated(page);
  await page.locator("[data-pdf-project-412-unreadable]").waitFor();
  assert.equal(await choices.locator('option[value="' + legacy[0].id + '"]').count(), 0);
  assert.equal((await records(page)).legacy[0].schemaVersion, 1);
  assert.equal((await records(page)).legacy[0].hash, expectedHash);
  assert.deepEqual(offsite, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({
    ticket: 474, status: "PASS", migration: "v1→v2", v1Preserved: true,
    reloadAndUndoRedo: true, collisionRefused: true, writeAbortRefused: true,
    futureSchemaRefused: true, independentSha256: expectedHash,
    v2SnapshotsBeforeCorruption: 2, offsiteRequests: offsite.length,
  }));
} finally {
  await context?.close();
  if (browser) {
    if (process.env.STR412_BROWSER_MODE === "cdp") browser._connection.close();
    else await browser.close();
  }
  server.kill();
}

// Run the independently isolated image editor v1/v2 consumer on the same compiled dist.
await import("./str-412-image-consumer.browser.mjs");
