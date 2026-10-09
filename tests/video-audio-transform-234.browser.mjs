// Independent real browser proof (desktop Chromium, NOT physical iOS/Android).
// node tests/video-audio-transform-234.browser.mjs
// Starts local Astro dev only, avoiding full-site build or shared generated artifacts.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 18476;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root, stdio: "ignore",
});
let browser;
let checks = 0;

function inspectWav(bytes, expectedHz) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset) => String.fromCharCode(...bytes.slice(offset, offset + 4));
  assert.equal(tag(0), "RIFF");
  assert.equal(tag(8), "WAVE");
  assert.equal(tag(12), "fmt ");
  assert.equal(tag(36), "data");
  assert.equal(data.getUint16(20, true), 1, "uncompressed PCM");
  assert.equal(data.getUint16(22, true), 1, "mono source");
  assert.equal(data.getUint16(34, true), 16, "16-bit signed PCM");
  const rate = data.getUint32(24, true);
  const pcmBytes = data.getUint32(40, true);
  assert.equal(rate, 48_000);
  assert.equal(data.getUint32(4, true), bytes.length - 8);
  assert.equal(pcmBytes + 44, bytes.length);
  assert.equal(pcmBytes, rate, "exact half-second trim sample count");
  // Inspect real PCM samples independently of the app's WAV writer. Skip transition edges.
  const start = Math.round(0.075 * rate);
  const stop = Math.round(0.425 * rate);
  let crossings = 0;
  let sumSquares = 0;
  let previous = data.getInt16(44 + start * 2, true);
  for (let index = start + 1; index < stop; index++) {
    const sample = data.getInt16(44 + index * 2, true);
    if (previous <= 0 && sample > 0) crossings++;
    sumSquares += (sample / 32768) ** 2;
    previous = sample;
  }
  const frequency = crossings * rate / (stop - start);
  const rms = Math.sqrt(sumSquares / (stop - start));
  assert(Math.abs(frequency - expectedHz) < 8, `frequency ${frequency} expected ${expectedHz}`);
  assert(rms > 0.03, `real audio energy ${rms}`);
  checks += 12;
  return { frequency, rms, bytes: bytes.length };
}

try {
  let started = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(`Dev server exited ${server.exitCode}`);
    try { if ((await fetch(`${origin}/tools/video-inspector/`)).ok) { started = true; break; } }
    catch { /* not yet listening */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(started, "Astro local route available");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errors = [];
  const offsite = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
  });
  await page.goto(`${origin}/tools/video-inspector/`, { waitUntil: "networkidle" });
  const picker = page.locator("[data-video-frame-camera-305] input[type=file]");
  const panel = page.locator("[data-video-audio-234]");
  await panel.waitFor({ timeout: 20_000 });
  await picker.setInputFiles(resolve(root, "tests/video-audio-234-two-tones.mp4"));

  const results = [];
  for (const [start, end, expectedHz] of [["0.25", "0.75", 440], ["1.25", "1.75", 880]]) {
    await panel.locator('input[type="number"]').nth(0).fill(start);
    await panel.locator('input[type="number"]').nth(1).fill(end);
    await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
    await panel.locator("[data-video-audio-result]").waitFor({ timeout: 30_000 });
    const receipt = await panel.locator("[data-video-audio-result]").innerText();
    assert(receipt.includes("PCM16 WAV"));
    assert(receipt.includes("0.500 s"));
    const downloading = page.waitForEvent("download");
    await panel.getByRole("link", { name: "Scarica WAV PCM16" }).click();
    const download = await downloading;
    assert.equal(download.suggestedFilename(), "audio-estratto.wav");
    const wav = new Uint8Array(await readFile(await download.path()));
    results.push(inspectWav(wav, expectedHz));
    checks += 4;
  }
  // Refusal: a video without audio is not silently treated as successful extraction.
  await picker.setInputFiles(resolve(root, "tests/video-frame-305-red-green.mp4"));
  await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
  await panel.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_CODEC_UNSUPPORTED/u).waitFor({ timeout: 15_000 });
  assert.equal(await panel.locator("[data-video-audio-result]").count(), 0);
  checks += 2;
  // Refusal: invalid audio range never leaves the previous WAV downloadable.
  await picker.setInputFiles(resolve(root, "tests/video-audio-234-two-tones.mp4"));
  await panel.locator('input[type="number"]').nth(0).fill("1.5");
  await panel.locator('input[type="number"]').nth(1).fill("0.5");
  await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
  await panel.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_RANGE/u).waitFor({ timeout: 15_000 });
  assert.equal(await panel.locator("[data-video-audio-result]").count(), 0);
  checks += 2;
  assert.deepEqual(errors, []);
  assert.deepEqual(offsite, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  checks += 3;
  console.log(`#234 audio WAV: PASS ${checks} checks; ${JSON.stringify(results)}; refusals, no offsite, mobile viewport. Desktop Chromium only.`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
