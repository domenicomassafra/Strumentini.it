import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const url = pathToFileURL(resolve("design/proposals-2026-10-25/index.html")).href;
const browser = await chromium.launch({ headless: true });
const variants = ["minimal", "editorial", "workspace"];
const screens = ["home", "tool", "result", "account"];
const widths = [320, 390, 768, 1024, 1440];
let inspected = 0;
const errors = [];

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (!request.url().startsWith("file:")) errors.push("Unexpected network: " + request.url());
      });
      await page.goto(url);
      for (const variant of variants) {
        await page.locator('[data-variant-choice="' + variant + '"]').click();
        assert.equal(await page.locator("#prototype").getAttribute("data-variant"), variant);
        if (width <= 390) {
          await page.locator('[data-screen-choice="home"]').first().click();
          const stacked = await page.evaluate(() => {
            const first = document.querySelector(".hero-copy").getBoundingClientRect();
            const second = document.querySelector(".hero-aside").getBoundingClientRect();
            return second.top >= first.bottom - 1;
          });
          assert.equal(stacked, true, variant + "/" + width + " hero is cramped into two columns");
        }
        for (const screen of screens) {
          await page.locator('[data-screen-choice="' + screen + '"]').first().click();
          assert.equal(await page.locator('[data-screen="' + screen + '"]').isVisible(), true,
            variant + "/" + screen + "/" + width + " is invisible");
          assert.equal(await page.locator(".demo-warning").first().isVisible(), true);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
            variant + "/" + screen + "/" + width + " overflows horizontally");
          inspected++;
        }
        await page.locator("[data-theme-toggle]").click();
        assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
          variant + "/" + width + " dark overflow");
        await page.locator("[data-theme-toggle]").click();
        assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
      }
      if (width === 390) {
        await page.locator('[data-variant-choice="workspace"]').click();
        await page.locator('[data-screen-choice="tool"]').first().click();
        await page.locator('[data-next-screen="result"]').click();
        assert.equal(await page.locator('[data-screen="result"]').isVisible(), true,
          "Demo task does not navigate to demo result");
        assert.match(page.url(), /view=result/u, "Selected screen is not linkable");
        await page.keyboard.press("Tab");
        const focusVisibility = await page.evaluate(() =>
          document.activeElement?.matches(":focus-visible") === true);
        assert.equal(focusVisibility, true, "Tab focus is not visible");
      }
      if (width === 1024) {
        await page.evaluate(() => { document.body.style.zoom = "2"; });
        for (const variant of variants) {
          await page.locator('[data-variant-choice="' + variant + '"]').click();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
            variant + " overflows at 200% zoom");
        }
      }
      await page.close();
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log("STR-353 proposal browser acceptance: " + inspected +
    "/60 surfaces, five widths, both themes, keyboard, CSS zoom 200%, zero unexpected requests: PASS");
} finally {
  await browser.close();
}
