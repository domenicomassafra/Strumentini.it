// #330 custom renderer acceptance, on real local Astro dev:
// node tests/acceptance-recent-custom-330.mjs http://127.0.0.1:4977
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:4977";
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const secret = "PRIVATE_RECENT_CONTENT_330";
const card = `BEGIN:VCARD\nVERSION:3.0\nFN:Ada ${secret}\nEMAIL:private330@example.test\nEND:VCARD\n`;
const csv = `id,name\n1,${secret}\n1,${secret}\n2,other\n`;

async function readRecent(page) {
  return page.evaluate(async () => {
    // Opening an unknown IndexedDB name at version 1 would create an empty
    // database and prevent the application from creating its own object store.
    if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
    const open = indexedDB.open("utility-workbench", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
      const tx = db.transaction("state", "readonly");
      const req = tx.objectStore("state").get("workbench/state:v1");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result?.recent ?? []);
      tx.oncomplete = () => db.close();
    };
    });
  });
}

async function expectCount(page, id, expected) {
  await page.waitForFunction(async ([toolId, count]) => {
    try {
      const open = indexedDB.open("utility-workbench", 1);
      return await new Promise((resolve) => {
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("state")) { db.close(); resolve(false); return; }
          const tx = db.transaction("state", "readonly");
          const req = tx.objectStore("state").get("workbench/state:v1");
          req.onerror = () => resolve(false);
          req.onsuccess = () => resolve((req.result?.recent ?? []).find((row) => row.toolId === toolId)?.useCount === count);
          tx.oncomplete = () => db.close();
        };
      });
    } catch { return false; }
  }, [id, expected], { timeout: 18_000 });
}

async function openTool(page, route) {
  await page.goto(base + "/tools/" + route + "/", { waitUntil: "networkidle" });
}

async function assertMetadataOnly(page, expected) {
  const recent = await readRecent(page);
  assert.deepEqual(Object.keys(recent.find((item) => item.toolId === expected)).sort(),
    ["lastUsedAt", "toolId", "useCount"]);
  assert(recent.every((item) => !Number.isNaN(Date.parse(item.lastUsedAt))));
  assert(!JSON.stringify(recent).includes(secret));
  assert(!JSON.stringify(recent).includes("private330@example.test"));
  assert(!JSON.stringify(recent).includes("da-recenti-330"));
  assert(!JSON.stringify(recent).includes("example.test"));
  return recent;
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90_000);
  const forbiddenNetwork = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") forbiddenNetwork.push(request.method() + " " + request.url());
    if ((request.postData() ?? "").includes(secret) || request.url().includes(secret)) forbiddenNetwork.push("sensitive content in request");
    if (!request.url().startsWith(base) && !request.url().startsWith("data:") && !request.url().startsWith("blob:"))
      forbiddenNetwork.push("external request");
  });

  // 1: Custom VCF parser with private input and failures.
  console.log("CHECK #330 VCF route");
  await openTool(page, "vcf-viewer-csv-export");
  await page.getByRole("button", { name: "Apri VCF" }).click();
  assert.equal((await readRecent(page)).length, 0, "empty VCF should not count");
  await page.getByLabel("File VCF").setInputFiles({ name: "da-recenti-330.vcf", mimeType: "text/vcard", buffer: Buffer.from(card) });
  await page.getByRole("button", { name: "Apri VCF" }).click();
  await page.getByText("Contatti letti").waitFor();
  await page.locator("table tbody tr").first().waitFor();
  await expectCount(page, "vcf-viewer-csv-export", 1);
  await assertMetadataOnly(page, "vcf-viewer-csv-export");
  await page.getByLabel("File VCF").setInputFiles({ name: "da-recenti-330.vcf", mimeType: "text/vcard", buffer: Buffer.from("corrupted") });
  await page.getByRole("button", { name: "Apri VCF" }).click();
  await page.locator('.error[role="alert"]').first().waitFor();
  assert.equal((await readRecent(page)).find((item) => item.toolId === "vcf-viewer-csv-export")?.useCount, 1);

  // 2: Custom CSV table output, including double-submit exclusion and invalid input.
  console.log("CHECK #330 CSV route");
  await openTool(page, "csv-dedupe");
  await page.getByRole("button", { name: "Rimuovi duplicati" }).click();
  assert.equal((await readRecent(page)).some((item) => item.toolId === "csv-dedupe"), false);
  await page.getByLabel("File CSV").setInputFiles({ name: "da-recenti-330.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByText(/da-recenti-330.csv/u).waitFor({ timeout: 10000 }).catch(async () => {
    throw Error("CSV file did not load: " + (await page.locator("body").innerText()).slice(0, 1400));
  });
  await page.getByRole("button", { name: "Rimuovi duplicati" }).evaluate((button) => {
    button.click();
    button.click();
  });
  await page.getByText("1 riga duplicata rimossa", { exact: true }).waitFor();
  await expectCount(page, "csv-dedupe", 1);
  await assertMetadataOnly(page, "csv-dedupe");

  // 3: Custom calculation with a real result and invalid timezone refusal.
  console.log("CHECK #330 timezone route");
  await openTool(page, "timezone-overlap");
  await page.getByLabel("Data nel tuo fuso orario").fill("2026-10-14");
  await page.getByLabel("Altro fuso orario").fill("Invalid/Timezone");
  await page.getByRole("button", { name: "Trova la sovrapposizione" }).click();
  await page.locator('.error[role="alert"]').first().waitFor();
  assert.equal((await readRecent(page)).some((item) => item.toolId === "timezone-overlap"), false);
  await page.getByLabel("Altro fuso orario").fill("America/New_York");
  await page.getByRole("button", { name: "Trova la sovrapposizione" }).click();
  await page.locator('[data-result-class="calculator"]').waitFor();
  await expectCount(page, "timezone-overlap", 1);
  await assertMetadataOnly(page, "timezone-overlap");

  // 4: Custom image resize, including verified output and no-file refusal.
  console.log("CHECK #330 resize route");
  await openTool(page, "image-resize");
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  await page.locator('.error[role="alert"]').first().waitFor();
  assert.equal((await readRecent(page)).some((item) => item.toolId === "image-resize"), false);
  const image = await readFile("quality/fixtures/image-metadata/workspace-base-4x4.png");
  await page.locator("#image-resize-file").setInputFiles({ name: "da-recenti-330.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Larghezza").fill("2");
  await page.getByLabel("Altezza").fill("2");
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  await page.locator('[data-result-class="image"]').first().waitFor({ timeout: 20_000 });
  await expectCount(page, "image-resize", 1);
  const recent = await assertMetadataOnly(page, "image-resize");
  assert.deepEqual(recent.map((item) => item.toolId), [
    "image-resize", "timezone-overlap", "csv-dedupe", "vcf-viewer-csv-export",
  ]);
  assert.deepEqual(errors, [], "browser runtime errors");
  assert.deepEqual(forbiddenNetwork, [], "no implicit upload or external network");

  await page.goto(base + "/preferiti/", { waitUntil: "networkidle" });
  console.log("CHECK #330 preferiti persistence");
  await page.locator("[data-area-activity] li").first().waitFor();
  const activity = await page.locator("[data-area-activity]").innerText();
  assert.match(activity, /VCF|vCard/iu);
  assert.match(activity, /CSV/iu);
  assert.match(activity, /fusi|sovrapposizione/iu);
  assert.match(activity, /ridimension/iu);
  assert(!activity.includes(secret) && !activity.includes("da-recenti-330"));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.deepEqual((await readRecent(page)).map((item) => item.toolId), recent.map((item) => item.toolId));
  await context.close();

  // IndexedDB denial: successful calculation remains usable; warning disclosed.
  console.log("CHECK #330 denied IndexedDB");
  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => Object.defineProperty(window, "indexedDB", {
    configurable: true, get() { throw new DOMException("Storage blocked", "SecurityError"); },
  }));
  const blocked = await blockedContext.newPage();
  await openTool(blocked, "timezone-overlap");
  await blocked.getByLabel("Data nel tuo fuso orario").fill("2026-10-14");
  await blocked.getByRole("button", { name: "Trova la sovrapposizione" }).click();
  await blocked.locator('[data-result-class="calculator"]').waitFor();
  await blocked.goto(base + "/preferiti/", { waitUntil: "networkidle" });
  await blocked.locator("[data-area-storage-warning]:not([hidden])").waitFor();
  await blockedContext.close();
  console.log("PASS #330 custom renderers VCF/CSV/timezone/image resize: real browser success→metadata-only IDB recents→preferiti→reload, failed validations not recorded, duplicate-submit guard, zero sensitive egress, storage-denial recovery.");
} finally {
  await browser.close();
}
