/** #344 browser acceptance. Real DOM/IndexedDB; mocked auth unauthenticated only. */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19444;
const origin = process.env.RECOMMENDATIONS_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.RECOMMENDATIONS_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* local server starting */ }
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error("Dev server exited early");
    if (i === 79) throw new Error("Dev server not ready");
    await sleep(250);
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const networkMutations = [];
  const errors = [];
  page.on("request", (request) => { if (request.method() !== "GET" && request.method() !== "HEAD") networkMutations.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  let authUnavailable = false;
  await page.route("**/api/auth/session", (route) => authUnavailable
    ? route.abort("failed")
    : route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthenticated"}' }));
  assert.equal((await page.goto(`${origin}/preferiti/`))?.status(), 200);
  const suggested = page.locator("[data-area-suggest] li");
  const empty = page.locator("[data-area-suggest-empty]");
  await empty.waitFor({ state: "visible" });
  assert.equal(await suggested.count(), 0, "Without completed tool use there is no invented personal popularity ranking");

  await page.evaluate(async () => {
    const req = indexedDB.open("utility-workbench", 1);
    const db = await new Promise((resolve, reject) => {
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("state")) req.result.createObjectStore("state"); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put({
        version: 1, installedTools: ["pdf-merge"], packs: [], layout: { mode: "list" },
        preferences: { compactRows: false },
        profile: { locale: "it-IT", timezone: "Europe/Rome", currency: "EUR", dateFormat: "system", numberFormat: "system", preferredUnits: "metric", workweek: ["MON", "TUE", "WED", "THU", "FRI"] },
        recent: [{ toolId: "pdf-merge", lastUsedAt: "2026-10-11T00:00:00.000Z", useCount: 2 }],
      }, "workbench/state:v1");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.setItem("strumentini:last-values:v1", JSON.stringify({"pdf-merge": { toolId: "pdf-merge", value: "DO_NOT_RENDER_FILE_CONTENT", at: "2026-10-11T01:00:00.000Z" }}));
  });
  await page.reload();
  await suggested.first().waitFor({ state: "visible" });
  assert((await suggested.count()) <= 4);
  assert((await suggested.first().innerText()).includes("2 operazioni in questa categoria su questo dispositivo"));
  assert.equal(await page.locator("[data-area-suggest] a[href*='?']").count(), 0);
  assert(!(await page.locator("[data-area-suggest]").innerText()).includes("DO_NOT_RENDER_FILE_CONTENT"));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);

  // Account endpoint unavailable: recommender still needs no backend.
  authUnavailable = true;
  await page.reload();
  await suggested.first().waitFor({ state: "visible" });
  assert((await suggested.first().innerText()).includes("2 operazioni in questa categoria"));

  // Reset local completion list: recommendations must disappear, including after reload.
  await page.evaluate(async () => {
    const req = indexedDB.open("utility-workbench", 1);
    const db = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      const get = tx.objectStore("state").get("workbench/state:v1");
      get.onsuccess = () => tx.objectStore("state").put({ ...get.result, recent: [] }, "workbench/state:v1");
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await empty.waitFor({ state: "visible" });
  assert.equal(await suggested.count(), 0);
  assert.deepEqual(networkMutations, [], "Recommendations don't POST account events or telemetry");
  assert.deepEqual(errors, [], "No page JS errors in anonymous/local/browser-reset flow");
  await context.close();
  console.log("#344 local Chromium PASS: anonymous empty, completed category explains 2 uses, no file values/POST, 390px, reset clears suggestions");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
