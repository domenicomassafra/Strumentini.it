/** Real built-site regression: private fiscal inputs never leak via native form GET without JS. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const origin = "http://127.0.0.1:19572";
const server = spawn("python3", ["-m", "http.server", "19572", "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser;
const scenarios = [
  { path: "/tools/stipendio-netto/", selector: "[data-salary-estimate-13] form", warning: "[data-salary-noscript]", values: { ral: "40000" }, enter: "ral" },
  { path: "/tools/partita-iva-validator/", selector: '[data-tax396="piva"] form', warning: "[data-forf-noscript]", values: { receipts: "30000" }, enter: "receipts" },
  { path: "/tools/calcoli-fiscali-italia/", selector: '[data-calculator="forf133"]', warning: "[data-forf133-noscript]", values: { revenue: "30000" }, enter: "revenue" },
  { path: "/tools/calcoli-fiscali-italia/", selector: '[data-calculator="net130"]', warning: "[data-fiscal-noscript]", values: { ral: "30000" }, checks: ["baseConfirmed"], enter: "ral", result: "Residuo annuo nazionale parziale" },
  { path: "/tools/calcoli-fiscali-italia/", selector: '[data-calculator="tfr134"]', warning: "[data-fiscal-noscript]", values: { prior: "10000", salary: "30000", historical: "30000", historyYears: "5" }, enter: "historical", result: "Totale TFR lordo teorico" },
  { path: "/tools/calcoli-fiscali-italia/", selector: '[data-calculator="bollo152"]', warning: "[data-fiscal-noscript]", values: { amount: "77,48" }, checks: ["single", "noExempt"], enter: "amount", result: "Riferimento guida Agenzia 2024" },
  { path: "/tools/irpef-componenti/", selector: "[data-irpef-components] form", warning: "[data-irpef-noscript]", values: { income: "40000" }, enter: "income", result: "IRPEF lorda nazionale" },
  { path: "/tools/iva-calcolo/", selector: "[data-tax-iva] form", warning: "[data-iva-noscript]", values: { amount: "1000" }, enter: "amount", result: "Totale lordo" },
];

async function enterValues(form, scenario) {
  for (const [name, value] of Object.entries(scenario.values)) await form.locator(`[name="${name}"]`).fill(value);
  for (const name of scenario.checks ?? []) await form.locator(`[name="${name}"]`).check();
}

try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(`Static server exited ${server.exitCode}`);
    try { ready = (await fetch(`${origin}/tools/stipendio-netto/`)).ok; } catch { /* Booting. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "actual generated site must serve fiscal pages");
  browser = await chromium.launch({ headless: true });
  for (const scenario of scenarios) {
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await noJs.newPage();
    const navigations = [];
    page.on("request", (req) => { if (req.isNavigationRequest()) navigations.push(req.url()); });
    assert.equal((await page.goto(origin + scenario.path))?.status(), 200);
    const form = page.locator(scenario.selector);
    assert.equal(await page.locator(scenario.warning).isVisible(), true, `${scenario.path} truthfully explains no-JS`);
    const button = form.locator('button[type="submit"]');
    assert.equal(await button.getAttribute("disabled"), "", `${scenario.selector} disabled in server HTML`);
    await enterValues(form, scenario);
    await button.scrollIntoViewIfNeeded();
    const bounds = await button.boundingBox();
    assert.ok(bounds, `${scenario.selector} has a visible submit button`);
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await form.locator(`[name="${scenario.enter}"]`).press("Enter");
    await page.waitForTimeout(100);
    assert.equal(new URL(page.url()).search, "", `${scenario.path} private field not exposed in URL`);
    assert.deepEqual(navigations.filter((url) => new URL(url).search !== ""), [], `${scenario.selector} click/Enter cause no data-bearing navigation`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${scenario.path} no mobile overflow`);
    await noJs.close();

    const withJs = await browser.newContext();
    const active = await withJs.newPage();
    const activeNavigations = [];
    active.on("request", (req) => { if (req.isNavigationRequest()) activeNavigations.push(req.url()); });
    await active.goto(origin + scenario.path);
    await active.waitForFunction((selector) => document.querySelector(selector)?.disabled === false, `${scenario.selector} button[type="submit"]`);
    if (scenario.result) {
      const activeForm = active.locator(scenario.selector);
      await enterValues(activeForm, scenario);
      await activeForm.locator('button[type="submit"]').click();
      const output = scenario.selector.includes("data-calculator")
        ? activeForm.locator("output")
        : active.locator(`${scenario.selector.slice(0, scenario.selector.indexOf(" form"))} output`);
      assert.ok((await output.textContent())?.includes(scenario.result), `${scenario.selector} calculates with JS enabled`);
      assert.equal(new URL(active.url()).search, "", `${scenario.selector} JS submit stays local`);
      assert.deepEqual(activeNavigations.filter((url) => new URL(url).search !== ""), [], `${scenario.selector} JS submit leaks no query`);
    }
    await withJs.close();
  }
  console.log(`PASS STR-013/014 actual Chrome: ${scenarios.length} forms no-JS click/Enter no GET; JS binds all and calculates on 5 new forms`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
