/** Screenshots for the owner's A/B/C comparison. No production deployment. */
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";

const root = resolve("design/proposals-2026-10-25");
const out = resolve(root, "previews");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const source = pathToFileURL(resolve(root, "index.html")).href;
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    try {
      const page = await context.newPage();
      await page.goto(source);
      for (const variant of ["minimal", "editorial", "workspace"]) {
        await page.locator('[data-variant-choice="' + variant + '"]').click();
        await page.locator('[data-screen-choice="home"]').first().click();
        await page.screenshot({ path: resolve(out, variant + "-home-" + viewport.name + ".png"), animations: "disabled" });
      }
    } finally {
      await context.close();
    }
  }
  console.log("Six A/B/C comparison screenshots captured at 1440 and 390.");
} finally {
  await browser.close();
}
