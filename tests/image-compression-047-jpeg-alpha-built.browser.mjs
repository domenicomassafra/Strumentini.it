/** Built public consumer: refuse silent JPEG alpha flatten; download opaque JPEG. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STR_047_ALPHA_PORT ?? 18581);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root,
  stdio: "ignore",
});
const w = 32, h = 24;
const rgba = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  rgba[4 * i] = 34;
  rgba[4 * i + 1] = 130;
  rgba[4 * i + 2] = 190;
  rgba[4 * i + 3] = i % 3 === 0 ? 0 : i % 3 === 1 ? 112 : 255;
}
const transparent = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
const opaque = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).flatten({ background: "#ffffff" }).png().toBuffer();
const presetPixels = Buffer.alloc(96 * 96 * 4);
let seed = 81;
for (let offset = 0; offset < presetPixels.length; offset += 4) {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  presetPixels[offset] = seed & 255;
  presetPixels[offset + 1] = (seed >>> 8) & 255;
  presetPixels[offset + 2] = (seed >>> 16) & 255;
  presetPixels[offset + 3] = 255;
}
const presetPng = await sharp(presetPixels, { raw: { width: 96, height: 96, channels: 4 } }).png().toBuffer();

async function ready() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + "/tools/image-compression/")).ok) return; }
    catch { /* local server starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Built consumer unavailable");
}
let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const offsite = [];
  page.on("request", request => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("data:") &&
        !request.url().startsWith("blob:")) offsite.push(request.url());
  });
  assert.equal((await page.goto(origin + "/tools/image-compression/"))?.status(), 200);
  const form = page.locator("form").filter({ has: page.locator("[data-png-lossless-47]") });
  assert.equal(await form.count(), 1, "Expected exactly one public raster compression form");
  await form.getByLabel("Formato di uscita").selectOption("image/jpeg");
  const upload = form.locator('input[type="file"]');
  await upload.setInputFiles({ name: "alpha.png", mimeType: "image/png", buffer: transparent });
  await form.getByRole("button", { name: "Esegui in locale" }).click();
  await page.locator(".result-panel[data-state='error']").waitFor({ timeout: 20_000 });
  assert.equal(await page.locator('[data-result-class="image"] a[download]').count(), 0);
  const target = form.locator("[data-target-image-compression] input[type='number']").first();
  await target.fill("10");
  await form.getByRole("button", { name: "Esegui in locale" }).click();
  await page.locator(".result-panel[data-state='error']").waitFor({ timeout: 20_000 });
  assert.equal(await page.locator('[data-result-class="image"] a[download]').count(), 0);
  await target.fill("");
  await upload.setInputFiles({ name: "opaque.png", mimeType: "image/png", buffer: opaque });
  await form.getByRole("button", { name: "Esegui in locale" }).click();
  await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 20_000 });
  const downloading = page.waitForEvent("download");
  await page.locator('[data-result-class="image"] a[download]').first().click();
  const download = await downloading;
  assert.equal(download.suggestedFilename(), "opaque-compressed.jpg");
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff");
  const info = await sharp(bytes).metadata();
  assert.equal(info.format, "jpeg");
  assert.equal(info.width, w);
  assert.equal(info.height, h);
  const preset = form.locator("[data-jpeg-preset-47] select");
  assert.equal(await preset.count(), 1, "JPEG normal/compact presets must be visible in the public form");
  await upload.setInputFiles({ name: "preset.png", mimeType: "image/png", buffer: presetPng });
  async function downloadPreset(mode) {
    await preset.selectOption(mode);
    await form.getByRole("button", { name: "Esegui in locale" }).click();
    await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 20_000 });
    const pending = page.waitForEvent("download");
    await page.locator('[data-result-class="image"] a[download]').first().click();
    const downloaded = await pending;
    assert.equal(downloaded.suggestedFilename(), "preset-compressed.jpg");
    const jpeg = await readFile(await downloaded.path());
    assert.equal(jpeg.subarray(0, 3).toString("hex"), "ffd8ff");
    const metadata = await sharp(jpeg).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 96);
    assert.equal(metadata.height, 96);
    return jpeg.length;
  }
  const normalBytes = await downloadPreset("normal");
  const compactBytes = await downloadPreset("compact");
  assert(compactBytes < normalBytes, `High-compression preset must reduce a noisy JPEG (${compactBytes} vs ${normalBytes} B)`);
  assert.deepEqual(offsite, []);
  console.log(`PASS #81 built public consumer: alpha JPEG refusal and valid JPEG downloads; normal ${normalBytes} B vs compact ${compactBytes} B; zero offsite requests`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
