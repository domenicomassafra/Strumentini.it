/** STR-385: run against a newly built dist, on MiniPC automation-browser CDP 17629. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const port = 18385;
const origin = `http://127.0.0.1:${port}`;
const sourcePixels = Buffer.from([
  255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 255, 255, 255, 255, 0, 255,
]);
const sourcePNG = await sharp(sourcePixels, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer();
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser, context, page;
const errors = [], external = [];

async function firstPixel() {
  return page.locator('[data-transform-preview="true"]').evaluate(canvas =>
    Array.from(canvas.getContext("2d").getImageData(0, 0, 1, 1).data));
}

async function waitPixel(pixel) {
  await page.waitForFunction(expected => {
    const canvas = document.querySelector('[data-transform-preview="true"]');
    return canvas && canvas.getContext("2d").getImageData(0, 0, 1, 1).data[0] === expected[0]
      && canvas.getContext("2d").getImageData(0, 0, 1, 1).data[1] === expected[1]
      && canvas.getContext("2d").getImageData(0, 0, 1, 1).data[2] === expected[2];
  }, pixel);
}

async function persisted(id) {
  return page.evaluate(async id => new Promise((resolve, reject) => {
    const req = indexedDB.open("strumentini-image-projects-385", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("projects");
    req.onerror = () => reject(req.error?.message);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("projects", "readonly");
      const get = tx.objectStore("projects").get(id);
      get.onsuccess = async () => {
        const item = get.result;
        if (!item) { resolve(null); return; }
        resolve({ revision: item.revision, rotate: item.transform.rotate,
          bytes: Array.from(new Uint8Array(await item.original.arrayBuffer())) });
      };
      tx.oncomplete = () => db.close();
    };
  }), id);
}

try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Static preview terminated");
    try { if ((await fetch(origin)).ok) break; } catch { /* startup */ }
    if (i === 99) throw new Error("Static preview unavailable");
    await delay(200);
  }
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629", { timeout: 45_000 });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (!["GET", "HEAD"].includes(request.method()) ||
      (!request.url().startsWith(origin) && !/^(blob|data):/.test(request.url()))) {
      external.push(`${request.method()} ${request.url()}`);
    }
  });
  assert.equal((await page.goto(origin + "/tools/image-crop/", { waitUntil: "domcontentloaded" })).status(), 200);
  await page.locator('[data-image-project-385]').waitFor();
  const untouchedCount = await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open("strumentini-image-projects-385", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("projects");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("projects", "readonly");
      const count = tx.objectStore("projects").count();
      count.onsuccess = () => resolve(count.result);
      tx.oncomplete = () => db.close();
    };
  }));
  assert.equal(untouchedCount, 0, "no implicit project save");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "original.png", mimeType: "image/png", buffer: sourcePNG });
  await waitPixel([255, 0, 0]);
  await page.getByRole("button", { name: "Ruota 90°" }).click();
  await waitPixel([0, 0, 255]);
  await page.getByRole("button", { name: "Annulla ultima modifica" }).click();
  await waitPixel([255, 0, 0]);
  await page.getByRole("button", { name: "Ripeti modifica" }).click();
  await waitPixel([0, 0, 255]);
  await page.getByRole("button", { name: "Salva progetto su questo dispositivo" }).click();
  await page.getByText("Progetto salvato su questo dispositivo", { exact: false }).waitFor();
  const select = page.getByLabel("Progetto immagine salvato");
  const savedId = await select.inputValue();
  assert.match(savedId, /^[a-f\d-]{36}$/i);
  const before = await persisted(savedId);
  assert.equal(before.rotate, 90);
  assert.deepEqual(Buffer.from(before.bytes), sourcePNG, "the stored original is byte-identical");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByLabel("Progetto immagine salvato").selectOption(savedId);
  await page.getByRole("button", { name: "Riapri progetto" }).click();
  await waitPixel([0, 0, 255]);
  assert.equal((await firstPixel())[2], 255);

  await page.getByRole("button", { name: "Esporta PNG verificato" }).click();
  const downloadLink = page.locator('a[download$=".png"]').first();
  await downloadLink.waitFor();
  const pending = page.waitForEvent("download");
  await downloadLink.click();
  const downloaded = await pending;
  const exported = await readFile(await downloaded.path());
  const decoded = await sharp(exported).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const canvasPixels = await page.locator('[data-transform-preview="true"]').evaluate(canvas =>
    Array.from(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data));
  assert.deepEqual([...decoded.data], canvasPixels, "flattened exported PNG exactly matches preview RGBA");

  // Quota failure is injected at the real browser storage boundary, including the IDB transaction.
  await page.getByRole("button", { name: "Ruota 90°" }).click();
  await waitPixel([255, 255, 0]);
  await page.evaluate(() => {
    window.__str385OriginalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { throw new DOMException("quota", "QuotaExceededError"); };
  });
  await page.getByRole("button", { name: "Salva progetto su questo dispositivo" }).click();
  await page.getByText(/Spazio locale esaurito/).waitFor();
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.__str385OriginalPut; delete window.__str385OriginalPut; });
  assert.deepEqual(await persisted(savedId), before, "quota failure retained exact original and project revision");

  // Old schema and corruption both refuse to overwrite the prior record.
  for (const value of [{ schema: "image-transform-project", version: 0, name: "old" },
    { schema: "image-transform-project", version: 1, original: "corrupt" }]) {
    await page.evaluate(async ({ id, value }) => new Promise((resolve, reject) => {
      const req = indexedDB.open("strumentini-image-projects-385", 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("projects", "readwrite");
        tx.objectStore("projects").put(value, id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }), { id: savedId, value });
    await page.getByRole("button", { name: "Riapri progetto" }).click();
    await page.getByText(/Progetto vecchio o danneggiato/).waitFor();
    assert.equal((await page.locator('[data-transform-preview="true"]').count()), 1, "active picture not discarded");
    await page.getByRole("button", { name: "Salva progetto su questo dispositivo" }).click();
    await page.getByText(/Progetto vecchio o danneggiato/).waitFor();
  }

  assert.deepEqual(external, [], "no external calls and no uploads");
  assert.deepEqual(errors, [], "no browser JavaScript errors");
  console.log(JSON.stringify({ status: "PASS", ticket: 144, suite: "str-385-consumer", viewport: "390x844",
    undo: true, redo: true, optIn: true, reload: true, pngFlattened: true,
    quotaFull: "REFUSED_ORIGINAL_INTACT", oldSchema: "REFUSED", corruptSchema: "REFUSED", uploads: 0 }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  process.exit(process.exitCode ?? 0);
}
