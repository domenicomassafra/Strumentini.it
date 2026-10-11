/** #337 browser proof using real result UI → actual image compression, then independent Sharp reopen. */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium, firefox, webkit } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const vite = await createServer({
  configFile: false,
  root,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "ticket-337-acceptance", configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url !== "/__handoff337-source" && request.url !== "/tools/image-compression/") return next();
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end('<!DOCTYPE html><html lang="it"><head><meta charset="utf-8" /></head><body><main id="root"></main><script type="module" src="/tests/acceptance-ephemeral-file-handoff-337.entry.tsx"></script></body></html>');
    });
  } }],
});

let passed = 0;
await vite.listen();
try {
  const address = vite.httpServer?.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const context = await browser.newContext({ acceptDownloads: true });
      const page = await context.newPage();
      const outside = [], errors = [];
      context.on("page", (opened) => opened.on("pageerror", (error) => errors.push(error.message)));
      page.on("pageerror", (error) => errors.push(error.message));
      context.on("request", (request) => {
        if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) outside.push(request.url());
      });
      assert.equal((await page.goto(`${origin}/__handoff337-source`))?.status(), 200);
      const send = page.locator("[data-png-compression-handoff-337]");
      await send.waitFor({ timeout: 25_000 });
      const popupEvent = page.waitForEvent("popup");
      await send.click();
      const popup = await popupEvent;
      await popup.locator('[data-handoff-337]').waitFor({ timeout: 25_000 });
      const status = await popup.locator('[data-handoff-337]').innerText();
      assert.match(status, /handoff-source-337\.png/);
      assert.match(status, /avvia manualmente/);
      assert.equal(new URL(popup.url()).hash, "", "One-use capability must be discarded");
      assert.equal(await popup.locator('[data-result-class="image"]').count(), 0, "No automatic compression");
      const outputMime = await popup.locator('select').first().inputValue();
      assert.equal(outputMime, "image/png");
      await popup.getByRole("button", { name: "Esegui in locale" }).click();
      await popup.locator('[data-result-class="image"]').waitFor({ timeout: 30_000 });
      const downloadEvent = popup.waitForEvent("download");
      await popup.getByRole("link", { name: /Scarica .*png/ }).first().click();
      const download = await downloadEvent;
      const bytes = readFileSync(await download.path());
      const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([decoded.info.width, decoded.info.height], [144, 96]);
      assert.equal(decoded.data.length, 144 * 96 * 4);
      assert.equal((await sharp(bytes).metadata()).format, "png");
      for (const [x, y] of [[0, 0], [17, 23], [143, 95]]) {
        const offset = (y * 144 + x) * 4;
        assert.deepEqual([...decoded.data.subarray(offset, offset + 4)],
          [(x * 11 + y) % 256, (x + y * 5) % 256, (x * 3 + y * 7) % 256, 255],
          `Pixel (${x}, ${y}) must still match the independent source equation`);
      }
      await page.evaluate(() => { window.open = () => null; });
      await send.click();
      assert.match(await page.locator('[data-png-handoff-status-337]').innerText(), /bloccato/);
      assert.deepEqual(outside, [], "No off-origin network requests");
      assert.deepEqual(errors, [], "Browser JS errors");
      console.log(`${engine.name()}: one-use verified PNG→compression→Sharp reopen PASS, ${bytes.length} result bytes`);
      passed++;
    } finally {
      await browser.close();
    }
  }
  console.log(`PASS #337 browser ${passed}/${passed} engines; local verified image source, manual compressor start, decoded result`);
} finally {
  await vite.close();
}
