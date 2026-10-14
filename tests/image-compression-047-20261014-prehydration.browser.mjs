/** #047: SSR controls cannot accept palette choices before the Preact island hydrates. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const dist = process.env.STRUMENTINI_047_HYDRATION_DIST ?? resolve(root, "dist");
const port = Number(process.env.STRUMENTINI_047_HYDRATION_PORT ?? 18471);
const origin = `http://127.0.0.1:${port}`;
const delay = (milliseconds) => new Promise((ready) => setTimeout(ready, milliseconds));
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], {
  cwd: root,
  stdio: "ignore",
});

const width = 96, height = 64;
const pixels = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const index = (y * width + x) * 4;
  pixels[index] = (x * 7 + y * 3) & 255;
  pixels[index + 1] = (x * 3 + y * 11) & 255;
  pixels[index + 2] = (x * 13 + y * 5) & 255;
  pixels[index + 3] = x % 4 === 0 ? 0 : 255;
}
const source = await sharp(pixels, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 0, palette: false }).toBuffer();

async function awaitServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${origin}/tools/image-compression/`)).ok) return;
    } catch { /* loopback starting */ }
    await delay(80);
  }
  throw new Error("Build /tools/image-compression/ in the selected dist directory first");
}

try {
  await awaitServer();
  let verified = 0;
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      try {
        const page = await context.newPage();
        const offsite = [], errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", async (route) => {
          const request = route.request();
          if (request.url().startsWith(origin) && request.method() === "GET") {
            // Deterministically hold the real island JS while SSR controls exist.
            if (/\/_astro\/ImageCompressionTool\.[^/]+\.js(?:\?|$)/u.test(request.url())) await delay(3_500);
            return route.continue();
          }
          offsite.push(`${request.method()} ${request.url()}`);
          return route.abort();
        });
        assert.equal((await page.goto(`${origin}/tools/image-compression/`, { waitUntil: "commit" }))?.status(), 200);
        const island = page.locator('astro-island[component-export="ImageCompressionTool"]');
        const form = island.locator("form");
        const guard = island.locator("[data-image-compression-hydration-gate]");
        const palette = form.locator("[data-png-palette-47] select");
        await palette.waitFor({ timeout: 10_000 });
        assert.equal(await island.getAttribute("ssr"), "", "this test did not intercept pre-hydration state");
        assert.equal(await guard.count(), 1, "SSR hydration guard must exist before JS is loaded");
        assert.equal(await guard.getAttribute("disabled"), "", "SSR guard must disable controls");
        assert.equal(await palette.isDisabled(), true, "SSR palette control is actionable before hydration");
        assert.equal(await form.locator('input[type="file"]').isDisabled(), true, "SSR file picker is actionable before hydration");
        assert.equal(await form.getByRole("button", { name: "Esegui in locale" }).isDisabled(), true,
          "SSR submit can run before state listeners exist");
        verified += 6;

        await page.waitForFunction(() => {
          const island = document.querySelector('astro-island[component-export="ImageCompressionTool"]');
          const gate = island?.querySelector('[data-image-compression-hydration-gate]');
          return island && !island.hasAttribute("ssr") && gate && !gate.hasAttribute("disabled");
        }, undefined, { timeout: 20_000 });
        assert.equal(await palette.isEnabled(), true);
        await palette.selectOption("lossy");
        await page.waitForFunction(() =>
          document.querySelector('astro-island[component-export="ImageCompressionTool"] input[type="file"]')?.getAttribute("accept") === "image/png,.png",
        undefined, { timeout: 10_000 });
        assert.equal(await form.getByLabel("Qualità, se supportata").count(), 0);
        verified += 3;

        await form.locator('input[type="file"]').setInputFiles({ name: "gradient.png", mimeType: "image/png", buffer: source });
        await form.getByRole("button", { name: "Esegui in locale" }).click();
        await page.getByText("Palette approssimata (perdita RGB dichiarata)").waitFor({ timeout: 20_000 });
        const link = page.locator('[data-result-class="image"] a[download]').first();
        const event = page.waitForEvent("download");
        await link.click();
        const download = await event;
        const bytes = await readFile(await download.path());
        const meta = await sharp(bytes).metadata();
        assert.equal(download.suggestedFilename(), "gradient-palette-lossy.png");
        assert.equal(meta.isPalette, true, "selected lossy palette produced a non-palette PNG");
        assert.equal(meta.width, width);
        assert.equal(meta.height, height);
        assert(bytes.byteLength < source.byteLength);
        const rgba = await sharp(bytes).ensureAlpha().raw().toBuffer();
        let maxRgbDelta = 0;
        for (let i = 0; i < rgba.length; i += 4) {
          assert.equal(rgba[i + 3], pixels[i + 3], `alpha drift at ${i / 4}`);
          for (let channel = 0; channel < 3; channel++)
            maxRgbDelta = Math.max(maxRgbDelta, Math.abs(rgba[i + channel] - pixels[i + channel]));
        }
        assert(maxRgbDelta > 0 && maxRgbDelta <= 32);
        assert.deepEqual(offsite, []);
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2), false);
        verified += 9;
        console.log(`${browserType.name()}: SSR blocked until hydrate; real lossy download ${source.byteLength}→${bytes.byteLength}B, max RGB error ${maxRgbDelta}, alpha exact`);
      } finally { await context.close(); }
    } finally { await browser.close(); }
  }
  console.log(`PASS #047 prehydration safety ${verified}/36 across Chromium+WebKit (native desktop browser only)`);
} finally { server.kill("SIGTERM"); }
