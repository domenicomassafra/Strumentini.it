/** #330 wave27: independently check real binary Base64 downloads and private Recenti. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.BASE64_330_PORT ?? 18573);
const origin = process.env.BASE64_330_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.BASE64_330_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" });
const toolId = "base64-codec";
const filename = "PRIVATE_BASE64_W27_original.bin";
const marker = "PRIVATE_BASE64_W27";
const buffer = Buffer.alloc(37_013);
for (let i = 0; i < buffer.length; i++) buffer[i] = (i * 97 + (i >>> 2) * 31 + (i >>> 7) * 23) & 255;
buffer.write(marker, 4, "ascii");
buffer[0] = 0;
buffer[1] = 255;
buffer[2] = 128;
buffer[3] = 0;
const expected = buffer.toString("base64");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZdQUAAAAASUVORK5CYII=", "base64");

async function stored(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" &&
      !(await indexedDB.databases()).some((entry) => entry.name === "utility-workbench")) return { recent: [], raw: "" };
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("utility-workbench", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve({ recent: [], raw: "" }); return; }
        const tx = db.transaction("state", "readonly");
        const all = tx.objectStore("state").getAll();
        all.onerror = () => reject(all.error);
        all.onsuccess = () => {
          const states = all.result;
          const recent = states.find((state) => state?.version === 1 && Array.isArray(state?.recent))?.recent ?? [];
          resolve({ recent, raw: JSON.stringify(states) });
        };
        tx.oncomplete = () => db.close();
      };
    });
  });
}

async function expectCount(page, count, timeout = 7000) {
  const until = Date.now() + timeout;
  let record;
  do {
    record = await stored(page);
    const matches = record.recent.filter((entry) => entry.toolId === toolId);
    if ((count === 0 && matches.length === 0) ||
      (matches.length === 1 && matches[0].useCount === count)) {
      if (count > 0) {
        assert.deepEqual(Object.keys(matches[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(!Number.isNaN(Date.parse(matches[0].lastUsedAt)));
      }
      for (const forbidden of [filename, marker, expected, expected.slice(300, 500), "PRIVATE_W27_IMAGE.png", png.toString("base64")]) {
        assert(!record.raw.includes(forbidden), `private source/output leaked to IndexedDB: ${forbidden.slice(0, 32)}`);
      }
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 85));
  } while (Date.now() < until);
  assert.fail(`expected Recenti ${toolId} count ${count}, received ${JSON.stringify(record?.recent)}`);
}

async function waitForResult(panel) {
  await panel.locator("[data-base64-file-result], [data-base64-byte-result]").first().waitFor({ timeout: 15000 });
}

async function downloadBytes(page, panel, name) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    panel.getByRole("button", { name }).click(),
  ]);
  const path = await download.path();
  assert(path, "browser did not produce downloadable bytes");
  return readFile(path);
}

async function selectFile(panel, data = buffer, name = filename) {
  await panel.locator('input[type="file"]').setInputFiles({ name, mimeType: "application/octet-stream", buffer: data });
}

let browser;
try {
  let ready = false;
  for (let i = 0; i < 130; i++) {
    try { ready = (await fetch(`${origin}/tools/${toolId}/`)).ok; if (ready) break; } catch { /* startup */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  assert(ready, "public Base64 route unavailable");
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [], external = [], writes = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()) || request.postData() !== null) writes.push(`${request.method()} ${request.url()}`);
  });
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(origin + "/") || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    external.push(url);
    return route.abort();
  });
  assert.equal((await page.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" }))?.status(), 200);
  const panel = page.locator("[data-base64-file-mode]");
  await panel.waitFor();
  await expectCount(page, 0);

  // Submit twice in one synchronous event turn, then independently reopen the
  // complete Base64 download; a preview or a mere success message is insufficient.
  await selectFile(panel);
  await panel.locator("form").evaluate((form) => {
    for (let i = 0; i < 2; i++) {
      assertSubmit(form);
    }
    function assertSubmit(element) {
      if (element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))) throw Error("Base64 form navigated");
    }
  });
  await waitForResult(panel);
  const encodedDownload = await downloadBytes(page, panel, "Scarica output completo");
  assert.equal(encodedDownload.toString("utf8"), expected, "raw file Base64 must match independent Node Buffer byte-for-byte");
  assert.deepEqual(Buffer.from(encodedDownload.toString(), "base64"), buffer, "reopened Base64 must recover original binary bytes");
  await expectCount(page, 1);
  console.log(`BASE64_W27_BINARY_GREEN independently decoded ${buffer.length} bytes from genuine downloaded Base64`);

  // Selecting a different mode must clear source-dependent result/actions.
  await panel.locator('select').first().selectOption("decode-bytes");
  assert.equal(await panel.locator("[data-base64-file-result]").count(), 0);
  await panel.locator("textarea").fill("!!!!bad-base64");
  await panel.getByRole("button", { name: "Decodifica byte" }).click();
  await panel.getByRole("status").waitFor();
  assert.equal(await panel.locator("[data-base64-byte-result]").count(), 0, "invalid bytes cannot produce downloadable output");
  await expectCount(page, 1);

  await panel.locator("textarea").fill(expected);
  await panel.getByRole("button", { name: "Decodifica byte" }).click();
  await panel.locator("[data-base64-byte-result]").waitFor();
  const decodedDownload = await downloadBytes(page, panel, "Scarica byte decodificati");
  assert.deepEqual(decodedDownload, buffer, "actual browser decoded-file download must match original binary bytes");
  await expectCount(page, 2);
  await panel.getByRole("button", { name: "Reimposta" }).click();
  assert.equal(await panel.locator("[data-base64-byte-result]").count(), 0);
  await expectCount(page, 2);

  // Force actual file.arrayBuffer to remain pending while changing source mode.
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function (...args) {
      if (!this.name.startsWith("DELAYED_")) return original.apply(this, args);
      return new Promise((resolvePromise, rejectPromise) => {
        window.__releaseBase64Read = () => {
          window.__releaseBase64Read = undefined;
          return original.apply(this, args).then(resolvePromise, rejectPromise);
        };
      });
    };
  });
  await panel.locator('select').first().selectOption("encode-file");
  await selectFile(panel, buffer, "DELAYED_PRIVATE_BASE64_W27.bin");
  await panel.getByRole("button", { name: "Codifica file" }).click();
  await page.waitForFunction(() => typeof window.__releaseBase64Read === "function");
  await panel.locator('select').first().selectOption("decode-bytes");
  await page.evaluate(() => window.__releaseBase64Read());
  await page.waitForTimeout(400);
  assert.equal(await panel.locator("[data-base64-file-result], [data-base64-byte-result]").count(), 0,
    "old pending encode must not republish result after source/mode change");
  await expectCount(page, 2);

  await panel.locator('select').first().selectOption("encode-file");
  await selectFile(panel, buffer, "DELAYED_PRIVATE_SOURCE_330.bin");
  await panel.getByRole("button", { name: "Codifica file" }).click();
  await page.waitForFunction(() => typeof window.__releaseBase64Read === "function");
  await selectFile(panel, Buffer.from([9, 8, 7, 6]), "FRESH_SOURCE.bin");
  await page.evaluate(() => window.__releaseBase64Read());
  await page.waitForTimeout(250);
  assert.equal(await panel.locator("[data-base64-file-result]").count(), 0,
    "changing the source file while reading must invalidate prior bytes");
  await expectCount(page, 2);

  // Reset also cancels a pending read; even a late resolve must stay absent.
  await selectFile(panel, buffer, "DELAYED_PRIVATE_RESET_330.bin");
  await panel.getByRole("button", { name: "Codifica file" }).click();
  await page.waitForFunction(() => typeof window.__releaseBase64Read === "function");
  await panel.getByRole("button", { name: "Reimposta" }).click();
  await page.evaluate(() => window.__releaseBase64Read());
  await page.waitForTimeout(250);
  assert.equal(await panel.locator("[data-base64-file-result]").count(), 0, "reset cannot publish late byte output");
  await expectCount(page, 2);

  // Base64url's alphabet and unpadded output are independently checked.
  const urlBytes = Buffer.from([0xfb, 0xff, 0xfa, 0x00, 0x01, 0x02, 0x80]);
  await panel.locator("select").nth(1).selectOption("url-safe");
  await selectFile(panel, urlBytes, "PRIVATE_W27_URL_BYTES.bin");
  await panel.getByRole("button", { name: "Codifica file" }).click();
  await panel.locator("[data-base64-file-result]").waitFor();
  const urlExpected = urlBytes.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  assert.equal((await downloadBytes(page, panel, "Scarica output completo")).toString(), urlExpected);
  await expectCount(page, 3);

  // Image branch independently validates both the data URL text and bytes
  // downloaded after MIME/header verification (same canonical Recenti ID).
  await panel.locator("select").first().selectOption("encode-image");
  await panel.locator("select").nth(1).selectOption("data-url");
  await panel.locator('input[type="file"]').setInputFiles({
    name: "PRIVATE_W27_IMAGE.png", mimeType: "image/png", buffer: png,
  });
  await panel.getByRole("button", { name: "Codifica immagine" }).click();
  await panel.locator("[data-base64-file-result]").waitFor();
  const imageData = `data:image/png;base64,${png.toString("base64")}`;
  assert.equal((await downloadBytes(page, panel, "Scarica output completo")).toString(), imageData,
    "image data URL must preserve original verified image bytes");
  await expectCount(page, 4);
  await panel.locator("select").first().selectOption("decode-image");
  await panel.locator("textarea").fill(imageData);
  await panel.getByRole("button", { name: "Decodifica immagine" }).click();
  await panel.locator("[data-base64-byte-result]").waitFor();
  assert.deepEqual(await downloadBytes(page, panel, "Scarica immagine verificata"), png);
  await expectCount(page, 5);

  assert.deepEqual(errors, [], "browser runtime errors");
  assert.deepEqual(external, [], "offsite requests");
  assert.deepEqual(writes, [], "writes or upload requests");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), "mobile horizontal overflow");
  await context.close();

  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await deniedContext.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("Denied", "SecurityError"); } });
  });
  const denied = await deniedContext.newPage();
  denied.on("pageerror", (error) => errors.push(String(error)));
  denied.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()) || request.postData() !== null) writes.push(`${request.method()} ${request.url()}`);
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) external.push(request.url());
  });
  await denied.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" });
  const deniedPanel = denied.locator("[data-base64-file-mode]");
  await selectFile(deniedPanel);
  await deniedPanel.getByRole("button", { name: "Codifica file" }).click();
  await deniedPanel.locator("[data-base64-file-result]").waitFor();
  assert.equal((await downloadBytes(denied, deniedPanel, "Scarica output completo")).toString(), expected,
    "IndexedDB denial cannot prevent real local Base64 conversion");
  assert.deepEqual(errors, [], "IndexedDB denial caused page errors");
  assert.deepEqual(external, [], "network leakage");
  assert.deepEqual(writes, [], "upload/write leakage");
  await deniedContext.close();
  console.log("BASE64_330_WAVE27_PASS genuine binary/image/base64url encode/decode downloads, duplicate count1, invalid/reset/cancel zero, stale source/mode cleared, metadata-only IndexedDB, denied IndexedDB usable, mobile, zero uploads/offsite");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
