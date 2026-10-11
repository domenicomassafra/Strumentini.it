// #330 independent browser evidence for bespoke renderers outside useToolOperation.
// node tests/acceptance-recent-bespoke-330.mjs http://127.0.0.1:4978
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:4978";
const secret = "PRIVATE_330_BESPOKE_CONTENT";
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

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

async function expectCount(page, toolId, expected) {
  const deadline = Date.now() + 20_000;
  let items = [];
  do {
    items = await recent(page);
    if (items.find((item) => item.toolId === toolId)?.useCount === expected) {
      assert.deepEqual(Object.keys(items.find((item) => item.toolId === toolId)).sort(), ["lastUsedAt", "toolId", "useCount"]);
      assert(!JSON.stringify(items).includes(secret), "recent metadata must never contain private input");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.fail(`${toolId} expected ${expected} completion(s): ${JSON.stringify(items)}`);
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60_000);
  const errors = [];
  const egress = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()) || request.url().includes(secret) || (request.postData() ?? "").includes(secret))
      egress.push(request.method() + " " + request.url());
    if (!request.url().startsWith(base) && !request.url().startsWith("data:") && !request.url().startsWith("blob:"))
      egress.push("external " + request.url());
  });
  const open = async (route) => {
    await page.goto(`${base}/tools/${route}/`, { waitUntil: "networkidle" });
    // Astro server HTML may already contain form controls before Preact handlers
    // hydrate; submitting those controls would be a false negative/positive.
    await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every((island) => !island.hasAttribute("ssr")), null, { timeout: 20_000 });
  };

  await open("password-strength-estimator");
  await page.getByLabel("Password da stimare").fill("x".repeat(5000));
  await page.getByRole("button", { name: "Stima e spiega" }).click();
  await page.locator('[role="alert"]').first().waitFor();
  assert.equal((await recent(page)).some((row) => row.toolId === "password-strength-estimator"), false);
  await page.getByLabel("Password da stimare").fill(secret);
  await page.getByRole("button", { name: "Stima e spiega" }).click();
  await page.getByText(/^Punteggio \d\/4:/u).waitFor();
  await expectCount(page, "password-strength-estimator", 1);

  await open("password-pin-passphrase-generator");
  await page.getByRole("button", { name: "Genera password" }).click();
  await page.locator("[data-secret-output]").waitFor();
  const generated = await page.locator("[data-secret-output]").textContent();
  assert(generated && generated.length > 0);
  await expectCount(page, "password-pin-passphrase-generator", 1);
  assert(!(JSON.stringify(await recent(page))).includes(generated));

  await open("campaign-name");
  assert.equal((await recent(page)).some((row) => row.toolId === "campaign-name"), false);
  await page.getByLabel("client", { exact: true }).fill(secret);
  await page.getByLabel("channel", { exact: true }).fill("email");
  await page.getByLabel("campaign", { exact: true }).fill("ottobre");
  await page.getByRole("button", { name: "Mostra anteprima" }).click();
  await page.locator('[data-result-class="text-code"]').waitFor({ timeout: 15_000 }).catch(async (error) => {
    throw new Error(`campaign result missing: hydration=${await page.locator('astro-island[component-url*="CampaignNameTool"]').getAttribute("ssr")} status=${await page.locator('[role="status"]').allTextContents()} fields=${JSON.stringify(await page.getByLabel("client", { exact: true }).inputValue())}`, { cause: error });
  });
  await expectCount(page, "campaign-name", 1);

  await open("csv-cleaner");
  await page.getByRole("button", { name: "Pulisci CSV" }).click();
  assert.equal((await recent(page)).some((row) => row.toolId === "csv-cleaner"), false);
  await page.getByLabel("File CSV").setInputFiles({ name: `${secret}.csv`, mimeType: "text/csv", buffer: Buffer.from(`id,name\n1,${secret}\n2,test\n`) });
  await page.getByRole("button", { name: "Pulisci CSV" }).evaluate((button) => { button.click(); button.click(); });
  await page.locator('[data-result-class="table"]').first().waitFor();
  await expectCount(page, "csv-cleaner", 1);

  await open("csv-column-map");
  await page.getByRole("button", { name: "Applica la mappatura" }).click();
  assert.equal((await recent(page)).some((row) => row.toolId === "csv-column-map"), false);
  await page.getByLabel("File CSV").setInputFiles({ name: `${secret}.csv`, mimeType: "text/csv", buffer: Buffer.from(`id,name\n1,${secret}\n`) });
  await page.getByLabel("Nome di uscita per la colonna di origine 1").waitFor();
  await page.getByRole("button", { name: "Applica la mappatura" }).evaluate((button) => { button.click(); button.click(); });
  await page.locator('[data-result-class="table"]').first().waitFor();
  await expectCount(page, "csv-column-map", 1);

  await open("file-hash");
  await page.getByRole("button", { name: /calcola/i }).click();
  assert.equal((await recent(page)).some((row) => row.toolId === "file-hash"), false);
  await page.locator("#file-hash-picker").setInputFiles({ name: `${secret}.txt`, mimeType: "text/plain", buffer: Buffer.from(secret) });
  await page.getByRole("button", { name: /calcola/i }).evaluate((button) => { button.click(); button.click(); });
  await expectCount(page, "file-hash", 1);

  await open("filename-sanitizer");
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  assert.equal((await recent(page)).some((row) => row.toolId === "filename-sanitizer"), false);
  await page.getByPlaceholder("Un nome per riga").fill(`${secret}?.txt`);
  await page.getByRole("button", { name: "Esegui in locale" }).evaluate((button) => { button.click(); button.click(); });
  await expectCount(page, "filename-sanitizer", 1);

  await page.goto(`${base}/preferiti/`, { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  const text = await page.locator("[data-area-activity]").innerText();
  assert(/CSV/iu.test(text) && /campagna|campaign/iu.test(text) && /password/iu.test(text));
  assert(!text.includes(secret) && !text.includes(generated));
  await page.reload({ waitUntil: "networkidle" });
  const persisted = await recent(page);
  assert.equal(persisted.filter((item) => item.toolId && item.useCount === 1).length, 7);
  assert(!JSON.stringify(persisted).includes(secret) && !JSON.stringify(persisted).includes(generated));
  assert.deepEqual(errors, [], "no runtime exceptions");
  assert.deepEqual(egress, [], "private files or values never sent to server");
  await context.close();
  console.log("PASS #330 seven bespoke real outputs → metadata-only IndexedDB → preferiti reload, invalid/duplicate submissions and no egress");
} finally {
  await browser.close();
}
