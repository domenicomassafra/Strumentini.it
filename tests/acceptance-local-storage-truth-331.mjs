/** #331: browser truth-in-copy plus actual removal of voluntary PDF bytes. */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const port = 19431;
const origin = process.env.COPY331_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.COPY331_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });
let browser;
const archiveName = "strumentini-optin-pdf-341";
const sentinel = "LOCAL_PDF_CONTENT_NEVER_ON_ACCOUNT";
const seedArchive = async (page) => page.evaluate(async ({ archiveName, sentinel }) => {
  const request = indexedDB.open(archiveName, 1);
  const db = await new Promise((resolve, reject) => {
    request.onupgradeneeded = () => request.result.createObjectStore("pdf", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction("pdf", "readwrite");
    tx.objectStore("pdf").put({ id: "test-owned-pdf", bytes: new TextEncoder().encode(sentinel) });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}, { archiveName, sentinel });
const archiveExists = (page) => page.evaluate(async (name) => {
  const databases = await indexedDB.databases();
  return databases.some((db) => db.name === name);
}, archiveName);

try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* local server startup */ }
    if (server?.exitCode != null) throw new Error("Astro exited before browser tests");
    if (i === 79) throw new Error("Astro never became ready");
    await sleep(250);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const mutations = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => { if (!['GET', 'HEAD'].includes(req.method())) mutations.push(req.url()); });
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthenticated"}' }));
  assert.equal((await page.goto(`${origin}/risorse/#privacy`, { waitUntil: "networkidle" }))?.status(), 200);
  const disclosure = await page.locator("#privacy").locator("xpath=..").innerText();
  assert.match(disclosure, /strumentini-optin-pdf-341/u);
  assert.match(disclosure, /non (?:è|sono) sincronizzat/iu);
  assert.match(disclosure, /cinque file/u);
  await page.locator(".resources-faq-item").filter({ hasText: "Conservate i miei file?" }).locator("summary").click();
  assert.match(await page.locator("body").innerText(), /Se scegli espressamente/u);

  // Create actual validated PDF output then exercise the explicit native save.
  assert.equal((await page.goto(`${origin}/tools/pdf-merge/`, { waitUntil: "networkidle" }))?.status(), 200);
  const fixture = readFileSync("quality/fixtures/pdf-gold/simple-2page.pdf");
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: "first.pdf", mimeType: "application/pdf", buffer: fixture },
    { name: "second.pdf", mimeType: "application/pdf", buffer: fixture },
  ]);
  await page.getByRole("button", { name: "Unisci PDF", exact: true }).click();
  await page.locator("[data-saved-pdf341-save] button").waitFor({ state: "visible" });
  await page.locator("[data-saved-pdf341-save] button").click();
  await page.locator("[data-saved-pdf341-list] > li").first().waitFor({ state: "visible" });
  assert(await archiveExists(page));

  assert.equal((await page.goto(`${origin}/impostazioni/`, { waitUntil: "networkidle" }))?.status(), 200);
  await page.locator('[data-settings-tab="privacy"]').click();
  const settingsText = await page.locator('[data-settings-panel="privacy"]').innerText();
  assert.match(settingsText, /strumentini-optin-pdf-341/u);
  assert.match(settingsText, /non sincronizzati con l'account/u);
  const clear = page.locator("[data-local-clear]");
  await clear.click();
  assert.match(await clear.innerText(), /Conferma/u);
  assert(await archiveExists(page), "First press is only a confirmation, without deletion");
  await clear.click();
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.querySelector('[data-local-clear][data-armed="true"]'));
  assert.equal(await archiveExists(page), false, "The claimed local reset also deletes voluntarily saved PDFs");
  assert(!mutations.length, "The anonymous PDF/save/clear flow never POSTs file content");
  assert.deepEqual(errors, []);
  await page.close();

  // A database deletion refused by the browser must never report success.
  const denied = await browser.newContext();
  const blockedPage = await denied.newPage();
  await blockedPage.route("**/api/auth/session", (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthenticated"}' }));
  await blockedPage.goto(`${origin}/impostazioni/`, { waitUntil: "networkidle" });
  await seedArchive(blockedPage);
  assert(await archiveExists(blockedPage));
  await blockedPage.evaluate((name) => {
    const originalDelete = IDBFactory.prototype.deleteDatabase;
    IDBFactory.prototype.deleteDatabase = function (arg) {
      if (arg === name) throw new DOMException("Permission denied", "SecurityError");
      return originalDelete.call(this, arg);
    };
  }, archiveName);
  await blockedPage.locator('[data-settings-tab="privacy"]').click();
  await blockedPage.locator("[data-local-clear]").click();
  await blockedPage.locator("[data-local-clear]").click();
  await blockedPage.getByText("La cancellazione locale non è riuscita completamente", { exact: false }).waitFor();
  assert(await archiveExists(blockedPage), "Denied deletion keeps PDF bytes present and is disclosed");
  await denied.close();
  console.log("#331 Chromium PASS: copy differentiates temporary output/account-only favorites/opt-in local PDF; explicit clear deletes real saved output; refused deletion reports failure; no off-origin POST");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
