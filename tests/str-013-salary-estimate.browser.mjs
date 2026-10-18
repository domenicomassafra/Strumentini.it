/** Browser acceptance of actual built Italian RAL estimator, never a payroll certification.
 * Run after build with static dist server on 127.0.0.1:18313. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = process.env.STR013_ORIGIN ?? "http://127.0.0.1:18313";
assert.match(origin, /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/u);
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.STRUMENTINI_CHROME_EXECUTABLE ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
let assertions = 0;
function check(condition, description) { assert.ok(condition, description); assertions++; console.log(`PASS ${description}`); }
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 840 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const response = await page.goto(`${origin}/tools/stipendio-netto/`, { waitUntil: "domcontentloaded" });
    check(response?.status() === 200, `actual salary page HTTP200 at ${width}px`);
    check((await page.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"),
      `unpromoted source-limited route noindex ${width}px`);
    const form = page.locator("[data-salary-estimate-13] form");
    check(await form.isVisible(), `real RAL form visible ${width}px`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2),
      `no horizontal overflow ${width}px`);
    const output = page.locator("[data-salary-result-13]");
    check((await output.textContent())?.trim() === "", `no invented result before input ${width}px`);
    await form.locator('[name="ral"]').fill("40000,00");
    await form.locator('[name="rate"]').fill("9,19");
    await form.locator('[name="year"]').selectOption("2026");
    await form.locator('[name="months"]').selectOption("13");
    await form.locator('button[type="submit"]').click();
    const first = await output.innerText();
    check(first.includes("27.137,08") && first.includes("parziale") && first.includes("busta paga"),
      `2026 scenario & visible omissions ${width}px`);
    await form.locator('[name="months"]').selectOption("14");
    check((await output.textContent())?.trim() === "", `changing months invalidates stale output ${width}px`);
    await form.locator('button[type="submit"]').click();
    const next = await output.innerText();
    check(next.includes("27.137,08") && next.includes("14 mensilità") && next !== first,
      `monthly presentation changes but annual tax does not ${width}px`);
    await form.locator('[name="rate"]').fill("9,999");
    await form.locator('button[type="submit"]').click();
    const alert = page.locator('[data-salary-estimate-13] [role="alert"]');
    check(await alert.isVisible() && (await alert.innerText()).includes("non supportati") &&
      (await output.textContent())?.trim() === "", `invalid assumptions refuse success ${width}px`);
    check(pageErrors.length === 0, `no uncaught browser errors ${width}px`);
    await context.close();
  }
} finally { await browser.close(); }
console.log(`PASS STR-013 ${assertions} real Chromium assertions across five viewports`);
