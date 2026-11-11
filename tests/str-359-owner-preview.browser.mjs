import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const url = pathToFileURL(resolve("dist/str-359-owner-preview/index.html")).href;
const previews = resolve("design/str-359-owner-preview/previews");
const variants = ["guide", "path"];
const views = ["resources", "error"];
const widths = [320, 390, 768, 1024, 1440];
const screenshots = new Map([[390, "mobile"], [1440, "desktop"]]);
const browser = await chromium.launch({ headless: true });
const browserErrors = [];
let verified = 0;
await mkdir(previews, { recursive: true });

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("request", (request) => {
        if (!request.url().startsWith("file:")) browserErrors.push(`Unexpected request: ${request.url()}`);
      });
      await page.goto(url);
      assert.equal(await page.locator("html").getAttribute("lang"), "it");
      assert.equal(await page.locator(".demo-notice").isVisible(), true);
      for (const variant of variants) {
        await page.getByRole("button", { name: variant === "guide" ? "A · Guida chiara" : "B · Percorso guidato" }).click();
        assert.equal(await page.locator("#prototype").getAttribute("data-variant"), variant);
        for (const view of views) {
          await page.locator(`.studio-bar [data-view-choice="${view}"]`).click();
          assert.equal(await page.locator(`[data-view="${view}"]`).isVisible(), true);
          assert.equal(await page.locator(`[data-view="${view === "resources" ? "error" : "resources"}"]`).isVisible(), false);
          assert.match(page.url(), new RegExp(`variant=${variant}&view=${view}`));
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
            `${variant}/${view}/${width}: horizontal overflow`);
          assert.equal(await page.locator("main h1:visible").count(), 1, `${variant}/${view}: must have one visible H1`);
          if (view === "resources") {
            await page.locator('[data-state-choice="cancelled"]').click();
            assert.match(await page.locator("[data-state-title]").innerText(), /annullata/u);
            await page.locator('[data-state-choice="success"]').click();
            assert.match(await page.locator("[data-state-description]").innerText(), /nessun file è stato prodotto/u);
            await page.locator('[data-state-choice="error"]').click();
            assert.equal(await page.locator('[data-state-choice="error"]').getAttribute("aria-pressed"), "true");
          } else {
            assert.match(await page.locator("#error-title").innerText(), /non c'è la pagina/u);
          }
          const readable = await page.evaluate(() => {
            function luminance(hex) {
              const rgb = hex.match(/\d+(?:\.\d+)?/gu)?.slice(0, 3).map(Number) ?? [];
              return rgb.map((component) => {
                const unit = component / 255;
                return unit <= .04045 ? unit / 12.92 : ((unit + .055) / 1.055) ** 2.4;
              }).reduce((total, component, index) => total + component * [.2126, .7152, .0722][index], 0);
            }
            function contrast(a, b) {
              const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
              return (x + .05) / (y + .05);
            }
            const sample = [...document.querySelectorAll(".surface h2, .surface > p, .lead, .error-main h1")]
              .filter((node) => node.getClientRects().length > 0);
            return sample.every((node) => {
              const foreground = getComputedStyle(node).color;
              let background = node;
              while (background && getComputedStyle(background).backgroundColor === "rgba(0, 0, 0, 0)") background = background.parentElement;
              return contrast(foreground, getComputedStyle(background ?? document.body).backgroundColor) >= 4.5;
            });
          });
          assert.equal(readable, true, `${variant}/${view}/${width}: sample body-text contrast below 4.5:1`);
          const name = screenshots.get(width);
          if (name) await page.screenshot({ path: resolve(previews, `${variant}-${view}-${name}.png`), fullPage: true, animations: "disabled" });
          verified++;
        }
      }
      await page.locator('.studio-bar [data-view-choice="resources"]').click();
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.matches(":focus-visible") === true), true,
        `Keyboard focus missing at ${width}px`);
      if (width === 1024) {
        await page.evaluate(() => { document.body.style.zoom = "2"; });
        for (const variant of variants) {
          await page.locator(`[data-variant-choice="${variant}"]`).click();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
            `${variant}: 200% CSS zoom overflow`);
        }
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(browserErrors, []);
  console.log(`STR-359 owner preview: ${verified}/20 variant/view/width cases PASS, 8 screenshots, keyboard, contrast, CSS zoom, zero page errors/network`);
} finally {
  await browser.close();
}
