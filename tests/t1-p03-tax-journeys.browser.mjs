/** Real Chromium consumers for STR-126, STR-127, STR-128. Start Astro dev on 4368. */
import { strict as assert } from "node:assert";
import { chromium } from "@playwright/test";

const origin = process.env.T1_P03_TEST_BASE_URL ?? "http://127.0.0.1:4368";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
const uploads = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (req) => { if (req.method() !== "GET" && req.method() !== "HEAD") uploads.push(req.url()); });
try {
  assert.equal((await page.goto(origin + "/tools/iva-calcolo/", { waitUntil: "domcontentloaded", timeout: 120000 }))?.status(), 200);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  await page.locator("#iva-amount").fill("100,00");
  await page.locator("#iva-custom-rate").fill("22");
  await page.locator('[data-tax-iva] button[type="submit"]').click();
  assert.match(await page.locator("[data-tax-iva] output").innerText(), /122,00\s*€/u);
  await page.locator("#iva-operation").selectOption("scorporo");
  await page.locator("#iva-amount").fill("122");
  await page.locator('[data-tax-iva] button[type="submit"]').click();
  assert.match(await page.locator("[data-tax-iva] output").innerText(), /100,00\s*€/u);
  await page.locator("#iva-mode").selectOption("preset");
  await page.locator("#iva-operation").selectOption("add");
  await page.locator("#iva-amount").fill("100");
  await page.locator("#iva-date").fill("2025-12-20");
  await page.locator("#iva-category").selectOption("tabA-ii-3-fresh-milk");
  assert.match(await page.locator("[data-category-scope]").innerText(), /Latte fresco.*non concentrato.*regime speciale agricolo/su);
  await page.locator('[name="scopeConfirmed"]').check();
  await page.locator('[name="taxableConfirmed"]').check();
  await page.locator('[data-tax-iva] button[type="submit"]').click();
  assert.match(await page.locator("[data-tax-iva] output").innerText(), /104,00\s*€/u);
  assert.match(await page.locator("[data-tax-iva] output").innerText(), /2025/u);
  await page.locator("#iva-date").fill("2025-12-12");
  await page.locator('[data-tax-iva] button[type="submit"]').click();
  assert.equal(await page.locator("[data-tax-iva] output").innerText(), "");
  assert.match(await page.locator("[data-tax-iva] .error").innerText(), /non disponibile/u);

  assert.equal((await page.goto(origin + "/tools/irpef-componenti/", { waitUntil: "domcontentloaded", timeout: 120000 }))?.status(), 200);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  await page.locator("#irpef-c-income").fill("40000");
  await page.locator('[data-irpef-components] button[type="submit"]').click();
  assert.match(await page.locator("[data-irpef-components] output").innerText(), /10\.640,00\s*€/u);
  assert.match(await page.locator("[data-irpef-components] output").innerText(), /NON calcolate/u);
  await page.locator("#irpef-c-region").selectOption("puglia");
  await page.locator("#irpef-c-city").selectOption("bari");
  await page.locator('[name="employee"]').check();
  await page.locator('[data-irpef-components] button[type="submit"]').click();
  const content = await page.locator("[data-irpef-components] output").innerText();
  for (const money of ["868,10", "581,00", "320,00", "10.672,90"]) {
    assert.ok(content.includes(money), `IRPEF result lacks ${money}: ${content}`);
  }
  // Regression: national IRPEF cancelled by the confirmed employee deduction
  // means no regional or municipal surtax in this scoped simulation.
  await page.locator("#irpef-c-income").fill("5000");
  assert.equal(await page.locator("[data-irpef-components] output").innerText(), "");
  await page.locator('[data-irpef-components] button[type="submit"]').click();
  const exempt = await page.locator("[data-irpef-components] output").innerText();
  assert.match(exempt, /IRPEF lorda nazionale: 1\.?150,00\s*€/u);
  assert.match(exempt, /puglia-regional: 0,00\s*€/u);
  assert.match(exempt, /bari-municipal: 0,00\s*€/u);
  assert.match(exempt, /Somma nazionale e componenti selezionate: 0,00\s*€/u);
  assert.match(exempt, /Non dovuta: IRPEF nazionale azzerata/u);
  assert.ok(!exempt.includes("66,50"));
  // Missing confirmation must not become a certain 66.50 EUR liability.
  await page.locator('[name="employee"]').uncheck();
  await page.locator('[data-irpef-components] button[type="submit"]').click();
  const unknown = await page.locator("[data-irpef-components] output").innerText();
  assert.match(unknown, /netta e somma delle componenti non determinate/u);
  assert.match(unknown, /IRPEF netta non determinata/u);
  assert.doesNotMatch(unknown, /puglia-regional:|bari-municipal:/u);
  await page.locator("#irpef-c-income").fill("40000");
  await page.locator('[name="employee"]').check();
  await page.locator("#irpef-c-year").selectOption("2026");
  await page.locator('[data-irpef-components] button[type="submit"]').click();
  const later = await page.locator("[data-irpef-components] output").innerText();
  assert.match(later, /10\.400,00\s*€/u);
  assert.match(later, /NON calcolate/u);
  const widths = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
  assert.ok(widths[1] <= widths[0] + 1, `horizontal overflow: ${widths}`);
  assert.deepEqual(errors, []);
  assert.deepEqual(uploads, []);
  console.log("PASS T1-p03 Chromium 390px: IVA custom + sourced 2025 presets and date refusal; IRPEF 2025 lines/deduction/Puglia/Bari, zero surtaxes at 5000 EUR, unknown net/surtaxes without confirmation and 2026 partial; noindex, no POST/JS errors");
} finally {
  await context.close();
  await browser.close();
}
