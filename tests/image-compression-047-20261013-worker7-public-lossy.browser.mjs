/**
 * #047 public route: a true many-color lossy PNG must change RGB by a bounded
 * amount while retaining every alpha byte in the ACTUAL browser download.
 * Run after a fresh `npm run build`.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PALETTE_W7_PORT ?? 18448);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root,
  stdio: "ignore",
});

async function waitForPage() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`${origin}/tools/image-compression/`);
      if (response.ok) return;
    } catch { /* local server is starting */ }
    await new Promise((ready) => setTimeout(ready, 100));
  }
  throw new Error("Public static image-compression route unavailable: run npm run build first");
}

const width = 96;
const height = 64;
const sourcePixels = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const at = (y * width + x) * 4;
  sourcePixels[at] = (x * 7 + y * 3) & 255;
  sourcePixels[at + 1] = (x * 3 + y * 11) & 255;
  sourcePixels[at + 2] = (x * 13 + y * 5) & 255;
  sourcePixels[at + 3] = x % 4 === 0 ? 0 : 255;
}
const sourcePng = await sharp(sourcePixels, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 0, palette: false }).toBuffer();

let verified = 0;
try {
  await waitForPage();
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      const page = await context.newPage();
      const offsite = [];
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        if (route.request().url().startsWith(origin) && route.request().method() === "GET") return route.continue();
        offsite.push(`${route.request().method()} ${route.request().url()}`);
        return route.abort();
      });
      assert.equal((await page.goto(`${origin}/tools/image-compression/`))?.status(), 200);
      const form = page.locator("form").filter({ has: page.locator("[data-png-lossless-47]") });
      const paletteSelect = form.locator("[data-png-palette-47] select");
      assert.deepEqual(await paletteSelect.locator("option").evaluateAll((options) => options.map((option) => option.value)),
        ["off", "exact", "lossy"]);
      await paletteSelect.selectOption("lossy");
      // React form re-renders asynchronously on WebKit; wait for the real
      // public control to apply the restricted picker before asserting.
      await page.waitForFunction(() => {
        const form = document.querySelector("[data-png-lossless-47]")?.closest("form");
        return form?.querySelector('input[type="file"]')?.getAttribute("accept") === "image/png,.png";
      }, undefined, { timeout: 15_000 });
      assert.equal(await form.locator("input[type=file]").getAttribute("accept"), "image/png,.png");
      assert.equal(await form.locator("[data-target-image-compression]").count(), 0);
      assert.equal(await form.getByLabel("Formato di uscita").count(), 0);
      assert.equal(await form.getByLabel("Qualità, se supportata").count(), 0);
      verified += 5;

      await form.locator("input[type=file]").setInputFiles({ name: "gradient.png", mimeType: "image/png", buffer: sourcePng });
      await form.getByRole("button", { name: "Esegui in locale" }).click();
      await page.getByText("Palette approssimata (perdita RGB dichiarata)").waitFor({ timeout: 20000 });
      await page.getByText("Alpha verificato identico").waitFor();
      const downloadEvent = page.waitForEvent("download");
      await page.locator('[data-result-class="image"] a[download]').first().click();
      const download = await downloadEvent;
      assert.equal(download.suggestedFilename(), "gradient-palette-lossy.png");
      const exported = await readFile(await download.path());
      const metadata = await sharp(exported).metadata();
      assert.equal(metadata.isPalette, true, "lossy public output is not actual PLTE PNG");
      assert.equal(metadata.width, width);
      assert.equal(metadata.height, height);
      assert(exported.length < sourcePng.length, "palette result should genuinely save bytes on test gradient");
      const outputPixels = await sharp(exported).ensureAlpha().raw().toBuffer();
      let maxError = 0;
      for (let i = 0; i < outputPixels.length; i += 4) {
        assert.equal(outputPixels[i + 3], sourcePixels[i + 3], `alpha changed at pixel ${i / 4}`);
        for (let channel = 0; channel < 3; channel++) {
          maxError = Math.max(maxError, Math.abs(outputPixels[i + channel] - sourcePixels[i + channel]));
        }
      }
      assert(maxError > 0, "lossy public output did not actually change RGB for high-color source");
      assert(maxError <= 32, `lossy public output changed RGB beyond bounded channel error: ${maxError}`);
      await page.getByText(String(maxError), { exact: true }).first().waitFor();
      verified += 10;

      await paletteSelect.selectOption("exact");
      await form.locator("input[type=file]").setInputFiles({ name: "gradient.png", mimeType: "image/png", buffer: sourcePng });
      await form.getByRole("button", { name: "Esegui in locale" }).click();
      await page.getByText("L'operazione non è riuscita. Controlla i file e i parametri inseriti.").waitFor({ timeout: 20000 });
      assert.equal(await page.locator('[data-result-class="image"] a[download]').count(), 0,
        "exact palette must refuse >256 unique RGBA colors");
      assert.deepEqual(offsite, []);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2), false);
      verified += 4;
      console.log(`${browserType.name()}: public gradient PNG ${sourcePng.length}→${exported.length}B, RGB delta ${maxError}/255, alpha exact, unsupported exact refused PASS`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`PASS #047 public high-color lossy PNG proof ${verified}/38 in Chromium + WebKit (real downloaded bytes, 390px; no physical-device claim)`);
} finally {
  server.kill("SIGTERM");
}
