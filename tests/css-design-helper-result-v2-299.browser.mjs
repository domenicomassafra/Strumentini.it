/** Compiled CSS helper acceptance for #299. Reuses the existing Playwright runner. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = process.env.STR299_ORIGIN ?? "http://127.0.0.1:18543";
const browser = process.env.STR299_CDP
  ? await chromium.connectOverCDP(process.env.STR299_CDP)
  : await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.method() !== "GET" || ![
        origin, "blob:", "data:",
      ].some((prefix) => request.url().startsWith(prefix))) {
        errors.push(`${request.method()} ${request.url()}`);
      }
    });
    const response = await page.goto(`${origin}/tools/css-design-helper/`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, "Compiled CSS helper route unavailable");
    assert.equal(await page.locator("[data-css-design-result]").count(), 0, "Result visible before submit");
    await page.getByLabel("Helper").selectOption("gradient");
    await page.getByLabel("Angolo (0–360°)").fill("90");
    await page.getByLabel("Colore iniziale").fill("#000000");
    await page.getByLabel("Colore finale").fill("#ffffff");
    await page.getByRole("button", { name: "Genera CSS" }).click();
    const result = page.locator('.result-panel[data-state="success"] [data-css-design-result]');
    await result.waitFor({ timeout: 15000 });
    const css = "background: linear-gradient(90deg, #000000, #ffffff);";
    assert.equal(await result.getByLabel("CSS canonico").inputValue(), css, "Canonical CSS changed");
    assert.equal(await result.getByText("Proprietà CSS").count(), 1, "Result v2 primary label absent");
    const preview = await result.getByLabel("Anteprima CSS").evaluate((element) =>
      getComputedStyle(element).backgroundImage);
    assert.match(preview, /linear-gradient\(90deg.*rgb\(0, 0, 0\).*rgb\(255, 255, 255\)/u);
    await result.getByRole("button", { name: "Copia CSS" }).click();
    await result.locator('p[role="status"]').filter({ hasText: "CSS copiato." }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), css, "Clipboard differs from preview");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true,
      "Unexpected 390px horizontal overflow");
    assert.deepEqual(errors, [], "Browser error or unexpected request");
    console.log("CSS #299 compiled Result v2, preview, clipboard and 390px: PASS");
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
