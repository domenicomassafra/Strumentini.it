/** #330 wave12 business-day registered bespoke producer, real browser RED→GREEN.
 * Run after an isolated local Astro server starts:
 * node tests/recent-wave12-330.browser.mjs http://127.0.0.1:4999
 */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://127.0.0.1:4999").replace(/\/$/u, "");
const id = "business-day";
const secret = "PRIVATE_330_WORKDAY_SENTINEL";

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("utility-workbench", 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
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

async function expectCount(page, expected) {
  const deadline = Date.now() + 10_000;
  let rows;
  do {
    rows = await recent(page);
    const row = rows.find((item) => item.toolId === id);
    if (row?.useCount === expected) {
      assert.deepEqual(Object.keys(row).sort(), ["lastUsedAt", "toolId", "useCount"]);
      assert(Number.isFinite(Date.parse(row.lastUsedAt)), "Last-used timestamp must parse");
      assert.equal(rows.filter((entry) => entry.toolId === id).length, 1);
      assert(!JSON.stringify(rows).includes(secret), "Never persist input in Recenti");
      assert(!JSON.stringify(rows).includes("2026-12-23") && !JSON.stringify(rows).includes("2026-12-28"), "Never persist dates/output");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.fail(`Expected ${id} useCount ${expected}; observed ${JSON.stringify(rows)}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [], outgoing = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!["GET", "HEAD"].includes(request.method()) || (request.postData() ?? "").includes(secret)
      || (!url.startsWith(base) && !url.startsWith("blob:") && !url.startsWith("data:"))) outgoing.push(`${request.method()} ${url}`);
  });
  assert.equal((await page.goto(`${base}/tools/${id}/`, { waitUntil: "networkidle" })).status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every((island) => !island.hasAttribute("ssr")), null, { timeout: 20_000 });
  assert.deepEqual(await recent(page), [], "Opening tool must not count as completion");

  // Empty date: actual runtime refuses; no output and no Recenti.
  await page.getByRole("button", { name: "Calcola" }).click();
  await page.locator('form p.error[role="alert"]').waitFor();
  assert.equal(await page.locator('[data-result-class="calculator"]').count(), 0);
  assert.deepEqual(await recent(page), []);

  await page.getByLabel("Data iniziale").fill("2026-12-23");
  await page.getByLabel("Giorni lavorativi da aggiungere").fill("2");
  await page.getByLabel(/Date escluse/u).fill("2026-12-25");
  // Duplicate synchronous submit must be treated as a single successful run.
  await page.getByRole("button", { name: "Calcola" }).evaluate((button) => { button.click(); button.click(); });
  await page.locator('[data-result-class="calculator"]').waitFor();
  assert.match(await page.locator('[data-result-slot="breakdown"]').innerText(), /2026-12-28/u);
  await expectCount(page, 1);

  // Result actions or Reset do not represent new completed operations.
  await page.locator('form .actions button[type="button"]').click();
  assert.equal(await page.locator('[data-result-class="calculator"]').count(), 0);
  assert.equal((await recent(page))[0]?.useCount, 1);

  // Real second operation, count business days instead of add.
  await page.getByRole("radio", { name: "Conta tra due date" }).check();
  await page.getByLabel("Data iniziale").fill("2026-12-23");
  await page.getByLabel("Data finale").fill("2026-12-28");
  await page.getByLabel(/Date escluse/u).fill("2026-12-25");
  await page.getByRole("button", { name: "Calcola" }).click();
  await page.locator('[data-result-class="calculator"]').waitFor();
  assert.match(await page.locator('[data-result-slot="breakdown"]').innerText(), /2/u);
  await expectCount(page, 2);

  // Immediately reset an async in-flight operation. Cold or warm dynamic
  // imports both settle on a later turn; stale success must never increment.
  await page.locator('form .actions button[type="button"]').click();
  await page.getByLabel("Data iniziale").fill("2026-12-23");
  await page.getByRole("button", { name: "Calcola" }).evaluate((button) => {
    button.click();
    button.closest("form").querySelector('.actions button[type="button"]').click();
  });
  await page.waitForTimeout(450);
  assert.equal(await page.locator('[data-result-class="calculator"]').count(), 0, "No stale result after Reset");
  assert.equal((await recent(page))[0]?.useCount, 2, "Cancelled job must not increment");

  // An invalid workweek refuses without counting, including after prior success.
  for (const box of await page.locator('.workweek-fieldset input[type="checkbox"]').all()) {
    if (await box.isChecked()) await box.uncheck();
  }
  await page.getByLabel("Data iniziale").fill("2026-12-23");
  await page.getByRole("button", { name: "Calcola" }).click();
  await page.locator('form p.error[role="alert"]').waitFor();
  assert.equal((await recent(page))[0]?.useCount, 2, "Rejected calendar must not count");

  await page.goto(`${base}/preferiti/`, { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /giorni lavorativi/iu);
  await page.reload({ waitUntil: "networkidle" });
  await expectCount(page, 2);

  // Browser storage getter failure must not prevent local calculation.
  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await deniedContext.addInitScript(() => Object.defineProperty(window, "indexedDB", {
    configurable: true, get() { throw new DOMException("Denied", "SecurityError"); },
  }));
  const denied = await deniedContext.newPage();
  denied.on("pageerror", (error) => errors.push(`denied: ${error.message}`));
  denied.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()) || (!request.url().startsWith(base) && !request.url().startsWith("blob:") && !request.url().startsWith("data:"))) outgoing.push(`denied ${request.method()} ${request.url()}`);
  });
  assert.equal((await denied.goto(`${base}/tools/${id}/`, { waitUntil: "networkidle" })).status(), 200);
  await denied.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every((island) => !island.hasAttribute("ssr")));
  await denied.getByLabel("Data iniziale").fill("2026-12-23");
  await denied.getByRole("button", { name: "Calcola" }).click();
  await denied.locator('[data-result-class="calculator"]').waitFor();
  await denied.goto(`${base}/preferiti/`, { waitUntil: "networkidle" });
  assert(await denied.locator("main").count() > 0);
  await deniedContext.close();

  assert.deepEqual(errors, [], "No page error");
  assert.deepEqual(outgoing, [], "No POST, sensitive payload egress, or remote requests");
  await context.close();
  console.log("PASS #330 wave12 business-day: real add/between outputs, failed+cancel/reset no count, duplicate once, metadata-only IDB, preferiti reload, storage denied usable, zero POST/offsite.");
} finally {
  await browser.close();
}
