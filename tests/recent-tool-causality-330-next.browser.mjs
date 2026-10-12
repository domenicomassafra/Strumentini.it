/** #330 wave19: REAL public tool success -> IndexedDB -> Home Recenti / preferiti / reload.
 * Run with: node tests/recent-tool-causality-330-next.browser.mjs http://127.0.0.1:19542
 * Local Chrome desktop viewport 390, never a physical mobile attestation.
 */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://127.0.0.1:19542").replace(/\/$/u, "");
const secret = "PRIVATE_CAUSALITY_330_NOT_FOR_STORAGE";
const picker = "random-picker-team-coupon-generator";

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
    const open = indexedDB.open("utility-workbench", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("state", "readonly");
      const get = tx.objectStore("state").get("workbench/state:v1");
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(get.result?.recent ?? []);
      tx.oncomplete = () => db.close();
    };
    });
  });
}

async function expectCount(page, id, count) {
  await page.waitForFunction(async ([toolId, expected]) => {
    try {
      // The completion recorder imports IndexedDB lazily. A read-only probe
      // must never win that race by creating a version-1 database without the
      // app's `state` store (indexedDB.open() itself is a write on first use).
      if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return false;
      return await new Promise((resolve) => {
        const open = indexedDB.open("utility-workbench", 1);
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("state")) { db.close(); resolve(false); return; }
          const tx = db.transaction("state", "readonly");
          const get = tx.objectStore("state").get("workbench/state:v1");
          get.onerror = () => resolve(false);
          get.onsuccess = () => resolve(get.result?.recent?.find((row) => row.toolId === toolId)?.useCount === expected);
          tx.oncomplete = () => db.close();
        };
      });
    } catch { return false; }
  }, [id, count], { timeout: 10_000 });
  const rows = await recent(page);
  assert.equal(rows.filter((row) => row.toolId === id).length, 1);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ["lastUsedAt", "toolId", "useCount"]);
    assert.match(row.lastUsedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    assert(Number.isFinite(Date.parse(row.lastUsedAt)) && Date.parse(row.lastUsedAt) <= Date.now() + 3_000);
  }
  assert(!JSON.stringify(rows).includes(secret), "Only ID, timestamp and count may persist");
  return rows.find((row) => row.toolId === id);
}

const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const errors = [];
const unexpectedRequests = [];
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(base) || !["GET", "HEAD"].includes(request.method()) || (request.postData() ?? "").includes(secret)) {
      unexpectedRequests.push(`${request.method()} ${request.url()}`);
    }
  });
}
async function navigate(page, path) {
  // Fresh Astro dev compilation of unrelated routes can take >30 seconds.
  // Only actual mounted controls and their operations are acceptance evidence.
  assert.equal((await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 }))?.status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every((island) => !island.hasAttribute("ssr")), null, { timeout: 60_000 });
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  watch(page);
  await navigate(page, `/tools/${picker}/`);
  assert.deepEqual(await recent(page), [], "opening a tool must not create activity");

  // Real engine failure and clearing/cancel do not create a phantom completion.
  await page.getByRole("spinbutton", { name: "Minimo incluso" }).fill("200");
  await page.getByRole("spinbutton", { name: "Massimo incluso" }).fill("10");
  await page.getByRole("button", { name: "Genera", exact: true }).click();
  await page.locator('[role="alert"]').first().waitFor();
  assert.deepEqual(await recent(page), []);

  await page.getByRole("spinbutton", { name: "Minimo incluso" }).fill("1");
  await page.getByRole("spinbutton", { name: "Massimo incluso" }).fill("100");
  await page.getByRole("combobox", { name: "Origine casualità" }).selectOption("seeded");
  await page.getByRole("textbox", { name: "Seed riproducibile" }).fill(secret);
  await page.getByRole("button", { name: "Genera", exact: true }).evaluate((button) => { button.click(); button.click(); });
  assert.match((await page.locator("[data-random-output]").innerText()).trim(), /^\d+$/u);
  const first = await expectCount(page, picker, 1);
  await page.getByRole("button", { name: "Cancella risultato" }).click();
  assert.equal((await recent(page))[0].useCount, 1, "clearing an ephemeral result isn't a new success");

  await navigate(page, "/tools/utm-builder/");
  await page.getByRole("textbox", { name: "URL di destinazione" }).fill("not a valid url");
  await page.getByRole("textbox", { name: "Sorgente" }).fill(secret);
  await page.getByRole("textbox", { name: "Mezzo" }).fill("email");
  await page.getByRole("textbox", { name: "Campagna" }).fill("ottobre");
  await page.getByRole("button", { name: "Crea URL" }).click();
  await page.locator('[data-state="error"].result-panel').waitFor();
  assert.equal((await recent(page)).find((row) => row.toolId === "utm-builder"), undefined);
  await page.getByRole("textbox", { name: "URL di destinazione" }).fill("https://example.invalid/path");
  await page.getByRole("button", { name: "Crea URL" }).click();
  await page.locator('[data-result-class="text-code"]').waitFor();
  const second = await expectCount(page, "utm-builder", 1);
  assert(Date.parse(second.lastUsedAt) >= Date.parse(first.lastUsedAt), "later successful tool is at least as recent");

  await navigate(page, "/");
  const home = page.locator("[data-recent-list] .tool-card-name a");
  await home.first().waitFor({ timeout: 10_000 });
  assert.deepEqual(await home.allTextContents(), ["Crea URL con UTM", "Genera numeri, estrazioni, team e coupon casuali"]);
  assert.equal(await home.first().getAttribute("href"), "/tools/utm-builder");
  assert.equal(await home.last().getAttribute("href"), `/tools/${picker}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await home.first().waitFor();
  assert.equal(await home.count(), 2);
  assert(!((await page.locator("[data-recent-section]").innerText()).includes(secret)));
  await navigate(page, "/preferiti/");
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.equal(await page.locator("[data-area-activity] li").count(), 2);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.equal(await page.locator("[data-area-activity] li").count(), 2);
  assert(!((await page.locator("[data-area-activity]").innerText()).includes(secret)));

  await navigate(page, `/tools/${picker}/`);
  const beforeRetry = (await recent(page)).find((item) => item.toolId === picker);
  assert.equal(beforeRetry?.useCount, 1, `Picker must stay at one completed operation until second genuine click; actual ${JSON.stringify(beforeRetry)}`);
  assert.equal(beforeRetry?.lastUsedAt, first.lastUsedAt, "The first completion timestamp must not change before retry");
  await page.getByRole("button", { name: "Genera", exact: true }).click();
  await page.locator("[data-random-output]").waitFor();
  const retried = await expectCount(page, picker, 2);
  assert(Date.parse(retried.lastUsedAt) >= Date.parse(second.lastUsedAt), `retry timestamp ${retried.lastUsedAt} older than previous UTM ${second.lastUsedAt} (picker first ${first.lastUsedAt})`);
  await navigate(page, "/");
  await home.first().waitFor();
  assert.equal(await home.first().getAttribute("href"), `/tools/${picker}`, "retry has newest Recenti position");
  assert.equal(await home.count(), 2);
  await context.close();

  const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await blockedContext.addInitScript(() => Object.defineProperty(window, "indexedDB", {
    configurable: true,
    get() { throw new DOMException("storage intentionally denied", "SecurityError"); },
  }));
  const denied = await blockedContext.newPage();
  watch(denied);
  await navigate(denied, `/tools/${picker}/`);
  await denied.getByRole("button", { name: "Genera", exact: true }).click();
  assert.match((await denied.locator("[data-random-output]").innerText()).trim(), /^\d+$/u);
  await navigate(denied, "/preferiti/");
  await denied.locator("[data-area-storage-warning]:not([hidden])").waitFor();
  await blockedContext.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(unexpectedRequests, [], "no POST, external requests or sensitive input egress");
  console.log("PASS #330 Chrome 390: true tool completion, double click once, invalid/clear zero, two canonical IDs/timestamps, Home+Preferiti reload, retry newest, IndexedDB denial, zero offsite.");
} finally {
  await browser.close();
}
