import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.env.ITALY040_TEST_BASE_URL ?? "http://127.0.0.1:4390";
const ordinary = fileURLToPath(new URL("../quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml", import.meta.url));
const toolIds = [
  "fatturapa-reader", "fatturapa-batch-csv", "ponti-ferie-optimizer",
  "italian-document-expiry", "inps-artigiani-commercianti", "gestione-separata-contributi",
];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [], externalRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).origin !== base) externalRequests.push(request.url()); });
  const goto = async (path, component) => {
    assert.equal((await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 }))?.status(), 200);
    if (component) await page.waitForFunction((componentName) => [...document.querySelectorAll("astro-island")].some((island) =>
      island.getAttribute("component-url")?.includes(componentName) && !island.hasAttribute("ssr")), component, { timeout: 60_000 });
  };

  await goto("/strumenti/");
  const section = page.locator("[data-italian-utilities]");
  await section.waitFor();
  assert.equal(await section.locator("[data-italian-tool]").count(), toolIds.length);
  for (const id of toolIds) {
    const card = section.locator(`[data-italian-tool="${id}"]`);
    assert.equal(await card.locator("a").getAttribute("href"), `/tools/${id}/`);
    assert((await card.locator("p").innerText()).length > 20);
  }

  await goto("/tools/fatturapa-reader/", "FatturaPaTools");
  await page.locator('input[type="file"]').setInputFiles(ordinary);
  await page.getByRole("button", { name: "Leggi fattura" }).click();
  const reader = page.locator('[data-oracle-entry="cand-255"]');
  await reader.waitFor({ timeout: 30_000 });
  assert.match(await reader.innerText(), /DEMO-1/u);
  assert.match(await reader.innerText(), /FPR12/u);
  assert.match(await reader.innerText(), /122\.00/u);

  await goto("/tools/fatturapa-batch-csv/", "FatturaPaTools");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "fatturapa-ordinary-anonymized.xml", mimeType: "application/xml", buffer: await readFile(ordinary) },
    { name: "non-valida.xml", mimeType: "application/xml", buffer: Buffer.from("<not-fatturapa />") },
  ]);
  await page.getByRole("button", { name: "Crea tabella e CSV" }).click();
  const batch = page.locator('[data-oracle-entry="cand-259"]');
  await batch.waitFor({ timeout: 30_000 });
  assert.match(await batch.innerText(), /1 file con errore/u);
  const downloading = page.waitForEvent("download");
  await batch.getByRole("button", { name: /Scarica/i }).first().click();
  const download = await downloading;
  assert.equal(download.suggestedFilename(), "fatturapa-batch.csv");
  const csv = await readFile(await download.path(), "utf8");
  assert.match(csv, /fatturapa-ordinary-anonymized.xml/u);
  assert.match(csv, /non-valida.xml/u);
  assert.match(csv, /DEMO-1/u);

  await goto("/tools/ponti-ferie-optimizer/", "PontiFerieOptimizerTool");
  await page.getByRole("button", { name: "Trova i ponti" }).click();
  const bridges = page.locator('[data-oracle-entry="cand-258"]');
  await bridges.waitFor({ timeout: 30_000 });
  assert.match(await bridges.innerText(), /Migliore opportunità/iu);
  assert.match(await bridges.innerText(), /2026/u);
  assert.match(await bridges.innerText(), /giorni/u);

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  console.log(`STR-040 REAL_BROWSER_PASS: ${toolIds.length} utility italiane navigabili, FatturaPA DEMO-1 letto, CSV misto scaricato ${Buffer.byteLength(csv)} B con errore isolato, ponti 2026 calcolati, mobile 390px, nessun errore JS né richiesta esterna`);
} finally { await browser.close(); }
