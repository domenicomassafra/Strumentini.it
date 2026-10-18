import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const address = "http://127.0.0.1:18168/tools/percentage-helper/";
const server = spawn("python3", ["-m", "http.server", "18168", "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser;

try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`static server exited ${server.exitCode}`);
    try { ready = (await fetch(address)).ok; } catch { /* Still starting. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "local route must start");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const response = await page.goto(address);
  assert.equal(response.status(), 200);
  const form = page.locator("[data-vat-calculator] form");
  const output = page.locator("[data-vat-result]");
  await form.locator('[name="amount"]').fill("100,00");
  await form.locator('[name="rate"]').fill("22");
  await form.getByRole("button", { name: /Calcola IVA/u }).click();
  assert.match(await output.locator("strong").innerText({ timeout: 3000 }), /^Totale lordo: 122,00\s*€/u, "adding IVA must announce the calculated gross before the breakdown");
  assert.match(await output.innerText(), /Imponibile: 100,00\s*€.*IVA: 22,00\s*€/su);
  assert.match(await output.innerText(), /Arrotondamento finale ai centesimi/u, "rounding policy remains disclosed");
  assert.match(await output.innerText(), /Arrotondamento finale ai centesimi \(metà verso l'alto\)/u);

  await form.locator('[name="operation"]').selectOption("scorporo");
  await form.locator('[name="amount"]').fill("122,00");
  await form.getByRole("button", { name: /Calcola IVA/u }).click();
  assert.match(await output.locator("strong").innerText({ timeout: 3000 }), /^Imponibile: 100,00\s*€/u, "scorporo must announce the calculated net before the breakdown");
  assert.match(await output.innerText(), /IVA: 22,00\s*€.*Totale lordo: 122,00\s*€/su);
  assert.match(await output.innerText(), /IVA calcolata per differenza/u, "inverse rounding policy remains disclosed");
  assert.match(await output.innerText(), /IVA calcolata per differenza dal totale lordo/u);

  await form.locator('[name="rate"]').fill("120");
  await form.getByRole("button", { name: /Calcola IVA/u }).click();
  assert.equal(await output.innerText(), "", "invalid inputs must clear previous valid results");
  assert.match(await page.locator("[data-vat-error]").innerText(), /Aliquota non valida/u);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `no horizontal overflow at ${width}px`);
  }
  await page.close();
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJsPage = await noJs.newPage();
  const navigations = [];
  noJsPage.on("request", (request) => { if (request.isNavigationRequest()) navigations.push(request.url()); });
  await noJsPage.goto(address);
  const noJsForm = noJsPage.locator("[data-vat-form]");
  assert.equal(await noJsPage.locator("[data-vat-noscript]").isVisible(), true, "no-JS disclosure is visible");
  assert.equal(await noJsForm.getByRole("button", { name: /Calcola IVA/u }).isDisabled(), true, "no-JS submit is disabled");
  await noJsForm.locator('[name="amount"]').fill("1234,56");
  await noJsForm.locator('[name="rate"]').fill("22");
  await noJsForm.locator('[name="rate"]').press("Enter");
  assert.equal(new URL(noJsPage.url()).search, "", "no-JS Enter must not expose entered amount in URL");
  assert.deepEqual(navigations.filter((url) => new URL(url).search !== ""), [], "no-JS never sends entered values via navigation");
  await noJs.close();
  console.log("STR-011 browser PASS: IVA add/scorporo, rounding, invalid states, 320/390/768/1440 and no-JS privacy");
} finally {
  if (browser) await browser.close();
  server?.kill("SIGTERM");
}
