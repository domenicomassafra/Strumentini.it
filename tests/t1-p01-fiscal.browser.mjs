/** Run with the local Astro dev server: npm exec astro dev -- --host 127.0.0.1 --port 4368 */
import { strict as assert } from "node:assert";
import { chromium } from "@playwright/test";

const origin = process.env.FISCAL_TEST_BASE_URL ?? "http://127.0.0.1:4368";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  assert.equal((await page.goto(`${origin}/tools/percentage-helper/`))?.status(), 200);
  await page.locator("#vat11-operation").selectOption("add");
  await page.locator("#vat11-amount").fill("100,00");
  await page.locator("#vat11-rate").fill("22");
  await page.locator("[data-vat11] button").click();
  assert.match(await page.locator("[data-vat11] output").innerText(), /Imponibile: 100,00\s*€.*IVA: 22,00\s*€.*Totale lordo: 122,00\s*€/su);
  await page.locator("#vat11-operation").selectOption("scorporo");
  await page.locator("#vat11-amount").fill("122,00");
  await page.locator("[data-vat11] button").click();
  assert.match(await page.locator("[data-vat11] output").innerText(), /Imponibile: 100,00\s*€/u);
  await page.locator("#vat11-rate").fill("120");
  await page.locator("[data-vat11] button").click();
  assert.match(await page.locator(".vat11-error").innerText(), /Aliquota non valida/u);

  assert.equal((await page.goto(`${origin}/tools/irpef-annuale/`))?.status(), 200);
  await page.locator("#irpef12-income").fill("40000");
  await page.locator("[data-irpef12] button").click();
  assert.match(await page.locator("[data-irpef12] output").innerText(), /10\.640,00\s*€/u);
  assert.equal(await page.locator("[data-irpef12] output li").count(), 3);
  await page.locator("#irpef12-year").selectOption("2026");
  await page.locator("[data-irpef12] button").click();
  assert.match(await page.locator("[data-irpef12] output").innerText(), /10\.400,00\s*€/u);
  assert.match(await page.locator("[data-irpef12] output").innerText(), /Addizionali: non calcolate/u);

  assert.equal((await page.goto(`${origin}/tools/stipendio-netto/`))?.status(), 200);
  await page.locator("#salary13-ral").fill("40000");
  await page.locator("#salary13-contributions").fill("9,19");
  await page.locator("[data-salary13] button").click();
  assert.match(await page.locator("[data-salary13] output").innerText(), /26\.970,60\s*€/u);
  await page.locator("#salary13-payments").selectOption("14");
  await page.locator("[data-salary13] button").click();
  assert.match(await page.locator("[data-salary13] output").innerText(), /26\.970,60\s*€/u);
  await page.locator("#salary13-year").selectOption("2026");
  await page.locator("[data-salary13] button").click();
  assert.match(await page.locator("[data-salary13] output").innerText(), /27\.137,08\s*€/u);

  assert.equal((await page.goto(`${origin}/tools/partita-iva-validator/`))?.status(), 200);
  await page.locator("#tax396-piva-ateco").fill("62.01.00");
  await page.locator("#tax396-piva-previous").fill("10000");
  await page.locator("#tax396-piva-current").fill("50000");
  await page.locator("#tax396-piva-contributions").fill("3000");
  await page.locator('[name="paidContributionsVerified"]').check();
  await page.locator('[name="eligible"]').check();
  await page.locator("#tax396-piva-form button").click();
  assert.match(await page.locator("#tax396-piva-output").innerText(), /42\.425,00\s*€/u);
  assert.match(await page.locator("#tax396-piva-output").innerText(), /67%/u);
  await page.locator("#tax396-piva-year").selectOption("2026");
  await page.locator("#tax396-piva-form button").click();
  assert.match(await page.locator(".tax396-piva-error").innerText(), /solo.*2025|soltanto il 2025/u);

  assert.deepEqual(errors, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  console.log("PASS T1-p01 Chromium mobile IVA add/scorporo, IRPEF scaglioni 2025/26, RAL 12/13/14 e anno, forfettario 2025/refusal 2026, zero page errors");
} finally {
  await page.close();
  await browser.close();
}
