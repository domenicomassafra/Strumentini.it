// #330 Wave 11: public-route RED→GREEN, bespoke random/picker/teams/coupon producer.
// Run: node tests/recent-wave11-330.browser.mjs http://127.0.0.1:4996
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://127.0.0.1:4996").replace(/\/$/u, "");
const toolId = "random-picker-team-coupon-generator";
const sentinel = "PRIVATE_RANDOM_330_";

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("utility-workbench", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
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

async function expectCount(page, count) {
  let records;
  const deadline = Date.now() + 8_000;
  do {
    records = await recent(page);
    const record = records.find((row) => row.toolId === toolId);
    if (record?.useCount === count) {
      assert.deepEqual(Object.keys(record).sort(), ["lastUsedAt", "toolId", "useCount"]);
      assert(!Number.isNaN(Date.parse(record.lastUsedAt)));
      assert.equal(records.filter((row) => row.toolId === toolId).length, 1);
      assert(!JSON.stringify(records).includes(sentinel), "no seed/picks/coupons persisted in recent metadata");
      return records;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.fail(`Expected ${toolId} count ${count}, observed ${JSON.stringify(records)}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!["GET", "HEAD"].includes(request.method()) || (request.postData() ?? "").includes(sentinel)
      || (!url.startsWith(base) && !url.startsWith("blob:") && !url.startsWith("data:"))) {
      requests.push({ method: request.method(), url });
    }
  });
  assert.equal((await page.goto(`${base}/tools/${toolId}/`, { waitUntil: "networkidle" })).status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every((island) => !island.hasAttribute("ssr")), null, { timeout: 20_000 });
  assert.deepEqual(await recent(page), [], "loading the producer must not create Recenti");

  // Genuine engine validation failure cannot create a completion.
  await page.getByRole("spinbutton", { name: "Minimo incluso" }).fill("200");
  await page.getByRole("spinbutton", { name: "Massimo incluso" }).fill("10");
  await page.getByRole("button", { name: "Genera", exact: true }).click();
  await page.locator('[role="alert"]').first().waitFor();
  assert.equal(await page.locator("[data-random-output]").count(), 0);
  assert.deepEqual(await recent(page), []);

  // Real RNG result. Two synchronous submits of one user activation must not
  // record twice; a later separate successful generation must count normally.
  await page.getByRole("spinbutton", { name: "Minimo incluso" }).fill("1");
  await page.getByRole("spinbutton", { name: "Massimo incluso" }).fill("100");
  await page.getByRole("combobox", { name: "Origine casualità" }).selectOption("seeded");
  await page.getByRole("textbox", { name: "Seed riproducibile" }).fill(`${sentinel}SEED`);
  await page.getByRole("button", { name: "Genera", exact: true }).evaluate((button) => { button.click(); button.click(); });
  await page.locator("[data-random-output]").waitFor();
  assert.match((await page.locator("[data-random-output]").innerText()).trim(), /^\d+$/u);
  await expectCount(page, 1);

  await page.getByRole("button", { name: "Cancella risultato" }).click();
  assert.equal(await page.locator("[data-random-output]").count(), 0);
  assert.equal((await recent(page))[0]?.useCount, 1, "clear/cancel must not count another completion");

  // Distinct current engine successes exercise every bespoke branch.
  await page.getByRole("combobox", { name: "Modalità" }).selectOption("picker");
  await page.getByRole("textbox", { name: "Una voce per riga" }).fill(`Ada\n${sentinel}PICK\nCarla`);
  await page.getByRole("button", { name: "Genera", exact: true }).click();
  assert.match(await page.locator("[data-random-output]").innerText(), /[1-3]\. /u);
  await expectCount(page, 2);

  await page.getByRole("combobox", { name: "Modalità" }).selectOption("teams");
  await page.getByRole("textbox", { name: "Una persona per riga" }).fill(`Ada\nBruno\n${sentinel}TEAM\nDiego`);
  await page.getByRole("button", { name: "Genera", exact: true }).click();
  assert.match(await page.locator("[data-random-output]").innerText(), /Team 1/u);
  await expectCount(page, 3);

  await page.getByRole("combobox", { name: "Modalità" }).selectOption("coupon");
  await page.getByRole("textbox", { name: "Prefisso facoltativo" }).fill(`${sentinel}CPN-`);
  await page.getByRole("button", { name: "Genera", exact: true }).click();
  assert.match(await page.locator("[data-random-output]").innerText(), /PRIVATE_RANDOM_330_CPN-/u);
  await expectCount(page, 4);
  await page.getByRole("spinbutton", { name: "Lunghezza casuale" }).fill("1");
  await page.getByRole("button", { name: "Genera", exact: true }).click();
  await page.locator('[role="alert"]').first().waitFor();
  assert.equal(await page.locator("[data-random-output]").count(), 0);
  assert.equal((await recent(page))[0]?.useCount, 4, "failure after prior success must not count");

  await page.goto(`${base}/preferiti/`, { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /casual|coupon|estraz/iu);
  await page.reload({ waitUntil: "networkidle" });
  await expectCount(page, 4);
  assert(!((await page.locator("[data-area-activity]").innerText()).includes(sentinel)));

  // Denied IDB is a degradable storage condition; generated output still works.
  const denied = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await denied.addInitScript(() => Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("Storage denied", "SecurityError"); } }));
  const deniedPage = await denied.newPage();
  deniedPage.on("pageerror", (error) => errors.push(`denied: ${error.message}`));
  deniedPage.on("request", (request) => {
    const url = request.url();
    if (!["GET", "HEAD"].includes(request.method()) || (!url.startsWith(base) && !url.startsWith("blob:") && !url.startsWith("data:"))) {
      requests.push({ method: request.method(), url });
    }
  });
  assert.equal((await deniedPage.goto(`${base}/tools/${toolId}/`, { waitUntil: "networkidle" })).status(), 200);
  await deniedPage.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every((island) => !island.hasAttribute("ssr")));
  await deniedPage.getByRole("button", { name: "Genera", exact: true }).click();
  await deniedPage.locator("[data-random-output]").waitFor();
  assert.match((await deniedPage.locator("[data-random-output]").innerText()).trim(), /^\d+$/u);
  await deniedPage.goto(`${base}/preferiti/`, { waitUntil: "networkidle" });
  assert.equal((await deniedPage.locator("main").count()) > 0, true, "preferiti usable when IDB denied");
  await denied.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(requests, [], "no POST, remote URLs or private input egress");
  await context.close();
  console.log("PASS #330 wave11 random/picker/teams/coupon: real four engine outputs, invalid+clear/cancel no count, duplicate submit once, metadata-only IDB, preferiti reload, denied IDB usable, no POST/external.");
} finally {
  await browser.close();
}
