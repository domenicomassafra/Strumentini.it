/** Real built-site regression: private fiscal inputs never leak via native form GET without JS. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const origin = "http://127.0.0.1:19572";
const server = spawn("python3", ["-m", "http.server", "19572", "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser;
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
  for (const scenario of [
    { path: "/tools/stipendio-netto/", selector: "[data-salary-estimate-13] form", warning: "[data-salary-noscript]", field: "ral", value: "40000" },
    { path: "/tools/partita-iva-validator/", selector: '[data-tax396="piva"] form', warning: "[data-forf-noscript]", field: "receipts", value: "30000" },
  ]) {
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await noJs.newPage();
    const navigations = [];
    page.on("request", (req) => { if (req.isNavigationRequest()) navigations.push(req.url()); });
    assert.equal((await page.goto(origin + scenario.path))?.status(), 200);
    const form = page.locator(scenario.selector);
    assert.equal(await page.locator(scenario.warning).isVisible(), true, `${scenario.path} truthfully explains no-JS`);
    assert.equal(await form.locator('button[type="submit"]').isDisabled(), true, `${scenario.path} initially refuses submit`);
    await form.locator(`[name="${scenario.field}"]`).fill(scenario.value);
    await form.locator(`[name="${scenario.field}"]`).press("Enter");
    assert.equal(new URL(page.url()).search, "", `${scenario.path} private field not exposed in URL`);
    assert.deepEqual(navigations.filter((url) => new URL(url).search !== ""), [], `${scenario.path} no data-bearing navigation`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${scenario.path} no mobile overflow`);
    await noJs.close();

    const withJs = await browser.newContext();
    const active = await withJs.newPage();
    await active.goto(origin + scenario.path);
    await active.waitForFunction((selector) => document.querySelector(selector)?.disabled === false, `${scenario.selector} button[type="submit"]`);
    await withJs.close();
  }
  console.log("PASS STR-013/014 actual Chrome: no-JS disabled submit/no query leakage, JS hydration enables both forms");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
