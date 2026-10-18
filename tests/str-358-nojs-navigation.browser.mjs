/** STR-358: real, independent Chrome acceptance against the built frontend.
 * Run after `npm run build` with a local static server:
 * STR358_ORIGIN=http://127.0.0.1:18358 node tests/str-358-nojs-navigation.browser.mjs
 * No HTTP interception, fake responses, external accounts or production writes.
 */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = process.env.STR358_ORIGIN ?? "http://127.0.0.1:18358";
assert.ok(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/u.test(origin), "Only a local built-site origin is permitted");
const browser = await chromium.launch({
  executablePath: process.env.STRUMENTINI_CHROME_EXECUTABLE ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
let checks = 0;
const verify = (condition, message) => { assert.ok(condition, message); checks++; console.log(`PASS ${message}`); };

try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`${origin}/impostazioni/`);
    verify(response?.status() === 200, `JS settings HTTP200 at ${width}px`);
    verify(await page.locator("[data-settings-nav]").getAttribute("aria-orientation") ===
      (width < 900 ? "horizontal" : "vertical"), `settings orientation ${width}px`);
    const ctas = page.locator(".ac-start-links a");
    verify(await ctas.count() === 2, `onboarding/preference links ${width}px`);
    verify((await ctas.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height)))
      .every((height) => height >= 44), `touch-sized links ${width}px`);
    await page.locator('a[href="#preferenze"]').click();
    await page.locator('[data-settings-panel="preferenze"]').waitFor({ state: "visible" });
    verify(await page.locator('[data-settings-panel="preferenze"]').isVisible(), `JS #preferenze opens panel ${width}px`);
    await page.locator('[data-settings-tab="preferenze"]').focus();
    await page.keyboard.press("ArrowRight");
    verify(await page.locator('[data-settings-tab="tema"]').getAttribute("aria-selected") === "true",
      `keyboard arrow opens next tab ${width}px`);
    verify(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2),
      `settings no horizontal overflow ${width}px`);
    verify(errors.length === 0, `settings JS no page exceptions ${width}px`);
    await context.close();
  }

  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 740 }, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${origin}/impostazioni/`);
    await page.locator('a[href="#preferenze"]').click();
    verify(new URL(page.url()).hash === "#preferenze", `no-JS native preferences anchor ${width}px`);
    const message = page.locator("#preferenze");
    verify(await message.isVisible() && /abilitare JavaScript/u.test(await message.textContent() ?? ""),
      `no-JS preference action has visible truthful fallback ${width}px`);
    await page.goto(`${origin}/onboarding/`);
    verify(await page.getByText(/Per completare i quattro passaggi.*abilita JavaScript/u).isVisible(),
      `no-JS onboarding explains activation requirement ${width}px`);
    verify(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2),
      `no-JS onboarding no overflow ${width}px`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("Denied", "SecurityError"); } });
    for (const key of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, key, { configurable: true, get() { throw new DOMException("Denied", "SecurityError"); } });
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/impostazioni/`);
  await page.locator('a[href="#preferenze"]').click();
  await page.locator('[data-settings-panel="preferenze"]').waitFor({ state: "visible" });
  verify(await page.locator('[data-settings-panel="preferenze"]').isVisible(), "denied-storage preferences still navigable");
  await page.goto(`${origin}/onboarding/`);
  verify(await page.locator('[data-onboarding-action="start"]').count() === 1, "denied-storage onboarding still renders");
  verify(errors.length === 0, "denied-storage no uncaught JS errors");
  await context.close();
} finally {
  await browser.close();
}
console.log(`PASS STR-358 ${checks} checks`);
