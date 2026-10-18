// #120 / STR-359: real-browser operation states and five responsive widths.
// Start Astro locally, then: node tests/str-359-file-privacy-state.browser.mjs http://127.0.0.1:19459
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = process.argv[2] ?? "http://127.0.0.1:19459";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const sizes = [320, 375, 390, 768, 1280];

try {
  for (const width of sizes) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/risorse/#come-funziona`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".resources-heading h1").count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}: no horizontal overflow on resources`);
    await page.goto(`${origin}/tools/filename-sanitizer/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
      .every((island) => !island.hasAttribute("ssr")));
    const result = page.locator(".result-panel");
    assert.equal(await result.getAttribute("data-state"), "idle", `${width}: initial state`);
    assert.equal(await result.locator("[data-result-class]").count(), 0, `${width}: no stale result`);
    await page.getByRole("button", { name: "Esegui in locale" }).click();
    await result.locator('[data-result-state="error"]').waitFor();
    assert.equal(await result.locator("[data-result-class]").count(), 0, `${width}: failed input cannot be a success`);
    await page.getByPlaceholder("Un nome per riga").fill("originale.txt");
    assert.equal(await result.getAttribute("data-state"), "idle", `${width}: editing invalidates failure`);
    if (width === 390) await context.setOffline(true);
    await page.getByRole("button", { name: "Esegui in locale" }).click();
    await result.locator('[data-result-state="success"]').waitFor();
    assert(await result.locator("[data-result-class]").count() > 0, `${width}: result is actually present`);
    if (width === 390) await context.setOffline(false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}: tool no horizontal overflow`);
    assert.deepEqual(errors, [], `${width}: no uncaught browser errors`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Hold a genuine File read open until after clicking Annulla, then let the
  // actual engine notice AbortSignal. No mocked tool result or synthetic click.
  await context.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 750));
      return original.call(this);
    };
  });
  const page = await context.newPage();
  await page.goto(`${origin}/tools/batch-checksum-manifest/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((island) => !island.hasAttribute("ssr")));
  await page.locator('input[type="file"]').setInputFiles({ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("contenuto") });
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  const panel = page.locator(".result-panel");
  await panel.locator('[data-result-state="running"]').waitFor();
  await page.getByRole("button", { name: "Annulla" }).click();
  await panel.locator('[data-result-state="cancelled"]').waitFor({ timeout: 5000 });
  assert.equal(await panel.locator("[data-result-class]").count(), 0, "cancelled work cannot publish output");
  assert.match(await panel.innerText(), /Annullata/u);
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  await panel.locator('[data-result-state="success"]').waitFor();
  await page.goto(`${origin}/tools/zip-contents-inspector/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((island) => !island.hasAttribute("ssr")));
  await page.locator('input[type="file"]').setInputFiles({ name: "non-zip.zip", mimeType: "application/zip", buffer: Buffer.from("not a ZIP archive") });
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  const invalidZip = page.locator(".result-panel");
  await invalidZip.locator('[data-result-state="error"]').waitFor();
  assert.equal(await invalidZip.locator("[data-result-class]").count(), 0, "unsupported/corrupt ZIP cannot publish a success");
  assert.match(await page.locator('[data-tool-error]').innerText(), /archivio|ZIP/iu);
  await context.close();
  console.log("PASS #120 STR-359: idle/error/success, offline-local, corrupt ZIP refusal, cancellation and retry; responsive widths 320/375/390/768/1280, no page errors");
} finally {
  await browser.close();
}
