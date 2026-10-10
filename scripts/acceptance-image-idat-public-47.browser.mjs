/**
 * #047 public opt-in route: real 390px browser UI -> local PNG recompression -> real download.
 * Requires a fresh `npm run build` before invocation; never deploys or changes certification.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "@playwright/test";
import sharp from "sharp";

const port = Number(process.env.STRUMENTINI_IDAT_ACCEPTANCE_PORT ?? 18447);
const origin = `http://127.0.0.1:${port}`;
const root = resolve(import.meta.dirname, "..");
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });

async function ready() {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(`${origin}/tools/image-compression/`)).ok) return;
    } catch { /* not started */ }
    await new Promise((resolveReady) => setTimeout(resolveReady, 100));
  }
  throw new Error("Static site server not available: build may be missing");
}

async function makeFixture() {
  const width = 64;
  const height = 48;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = (i * 31) & 255;
    rgba[i * 4 + 1] = (i * 7) & 255;
    rgba[i * 4 + 2] = (i * 13) & 255;
    rgba[i * 4 + 3] = i % 5 === 0 ? 0 : 255;
  }
  const source = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 0 }).toBuffer();
  return { source, rgba };
}

let checks = 0;
try {
  await ready();
  const { source, rgba } = await makeFixture();
  const paletteRaw = Buffer.alloc(64 * 48 * 4);
  for (let i = 0; i < 64 * 48; i++) {
    const blue = i % 3 === 0;
    paletteRaw[i * 4] = blue ? 0 : 255;
    paletteRaw[i * 4 + 1] = 0;
    paletteRaw[i * 4 + 2] = blue ? 255 : 0;
    paletteRaw[i * 4 + 3] = i % 7 === 0 ? 0 : 255;
  }
  const paletteSource = await sharp(paletteRaw, { raw: { width: 64, height: 48, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
  for (const [name, browserType] of Object.entries({ chromium, webkit })) {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      const page = await context.newPage();
      const offsite = [];
      const jsErrors = [];
      page.on("request", (request) => {
        if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
      });
      page.on("pageerror", (error) => jsErrors.push(error.message));
      await page.goto(`${origin}/tools/image-compression/`, { waitUntil: "networkidle" });
      const form = page.locator("form").last();
      await form.locator("[data-png-lossless-47] input[type=checkbox]").check();
      assert.equal(await form.locator("input[type=file]").getAttribute("accept"), "image/png,.png");
      assert.equal(await form.getByLabel("Formato di uscita").count(), 0);
      assert.equal(await form.locator("[data-target-image-compression]").count(), 0);
      checks += 3;

      await form.locator("input[type=file]").setInputFiles({ name: "alpha.png", mimeType: "image/png", buffer: source });
      await form.getByRole("button", { name: "Esegui in locale" }).click();
      await page.getByText("Byte delle scanline verificati identici").waitFor({ timeout: 20000 });
      const downloadLink = page.locator('[data-result-class="image"] a[download]').first();
      await downloadLink.waitFor();
      const downloadReady = page.waitForEvent("download");
      await downloadLink.click();
      const downloaded = await downloadReady;
      assert.equal(downloaded.suggestedFilename(), "alpha-idat-lossless.png");
      const actual = await readFile(await downloaded.path());
      assert.deepEqual(actual.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      assert.ok(actual.length < source.length, `expected real source ${source.length} to shrink, got ${actual.length}`);
      assert.deepEqual(await sharp(actual).ensureAlpha().raw().toBuffer(), rgba);
      checks += 4;

      await form.locator("input[type=file]").setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from([1, 2, 3]) });
      await form.getByRole("button", { name: "Esegui in locale" }).click();
      await page.getByText("L'operazione non è riuscita. Controlla i file e i parametri inseriti.").waitFor({ timeout: 20000 });
      assert.equal(await page.locator('[data-result-class="image"] a[download]').count(), 0);
      assert.deepEqual(offsite, []);
      assert.deepEqual(jsErrors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2), false);
      checks += 4;
      // Exercise the NEW public palette control, not just an isolated quantizer.
      await form.locator('[data-png-palette-47] select').selectOption('exact');
      assert.equal(await form.locator('[data-png-lossless-47] input[type=checkbox]').isChecked(), false);
      assert.equal(await form.locator('input[type=file]').getAttribute('accept'), 'image/png,.png');
      assert.equal(await form.locator('[data-target-image-compression]').count(), 0);
      await form.locator('input[type=file]').setInputFiles({ name: 'palette.png', mimeType: 'image/png', buffer: paletteSource });
      await form.getByRole('button', { name: 'Esegui in locale' }).click();
      await page.getByText('Alpha verificato identico').waitFor({ timeout: 20000 });
      const paletteDownload = page.waitForEvent('download');
      await page.locator('[data-result-class="image"] a[download]').first().click();
      const paletteFile = await paletteDownload;
      assert.equal(paletteFile.suggestedFilename(), 'palette-palette-exact.png');
      const paletteOutput = await readFile(await paletteFile.path());
      assert.deepEqual(await sharp(paletteOutput).ensureAlpha().raw().toBuffer(), paletteRaw);
      checks += 5;
      // The opt-in lossy variant must be genuinely exported, with alpha kept
      // bit-exact and independent observed RGB error bounded by its claim.
      await form.locator('[data-png-palette-47] select').selectOption('lossy');
      await form.locator('input[type=file]').setInputFiles({ name: 'palette.png', mimeType: 'image/png', buffer: paletteSource });
      await form.getByRole('button', { name: 'Esegui in locale' }).click();
      await page.getByText('Palette approssimata (perdita RGB dichiarata)').waitFor({ timeout: 20000 });
      const lossyEvent = page.waitForEvent('download');
      await page.locator('[data-result-class="image"] a[download]').first().click();
      const lossyDownload = await lossyEvent;
      assert.equal(lossyDownload.suggestedFilename(), 'palette-palette-lossy.png');
      const lossyPixels = await sharp(await readFile(await lossyDownload.path())).ensureAlpha().raw().toBuffer();
      let maxError = 0;
      for (let i = 0; i < lossyPixels.length; i += 4) {
        assert.equal(lossyPixels[i + 3], paletteRaw[i + 3], 'alpha changed by lossy mode');
        for (let j = 0; j < 3; j++) maxError = Math.max(maxError, Math.abs(lossyPixels[i + j] - paletteRaw[i + j]));
      }
      assert.ok(maxError <= 32, `lossy RGB error ${maxError} >32`);
      assert.deepEqual(offsite, []);
      assert.deepEqual(jsErrors, []);
      checks += 4;
      console.log(`${name}: public PNG IDAT + indexed exact/lossy, real downloads, independent pixel/alpha/loss limit, refusal, zero offsite/errors PASS`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`#047 public PNG opt-in browser PASS: ${checks}/40 checks (Chromium, WebKit at 390px; not a physical-mobile receipt)`);
} finally {
  server.kill("SIGTERM");
}
