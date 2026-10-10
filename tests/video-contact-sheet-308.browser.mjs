// After npm run build: node tests/video-contact-sheet-308.browser.mjs
// Chromium desktop 390px viewport; NOT physical device/media-decoder certification.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { unzipSync } from "fflate";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const port = 18440;
const origin = process.env.VIDEO38_BASE ?? `http://127.0.0.1:${port}`;
const server = process.env.VIDEO38_BASE ? null : spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser;
let checks = 0;
try {
  let started = false;
  for (let n = 0; n < 90; n++) {
    try { if ((await fetch(`${origin}/tools/video-inspector/`)).ok) { started = true; break; } } catch { /* local server warming */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(started, "Static video route available");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const offsite = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() !== "GET" || (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:"))) offsite.push(`${request.method()} ${request.url()}`);
  });
  await page.goto(`${origin}/tools/video-inspector/`, { waitUntil: "networkidle" });
  const picker = page.locator("[data-video-frame-camera-305]");
  await picker.locator('input[type="file"]').setInputFiles(resolve(root, "tests/video-frame-305-red-green.mp4"));
  const panel = page.locator("[data-video-contact-sheet-308]");
  await panel.waitFor({ timeout: 10_000 });
  checks++;
  await panel.getByRole("button", { name: "Genera contact sheet e ZIP" }).click();
  await Promise.race([
    panel.locator("[data-contact-result]").waitFor({ timeout: 25_000 }),
    panel.locator("[data-contact-status]").getByText(/VIDEO_CONTACT_|Errore|non verificabile/iu).waitFor({ timeout: 25_000 }).then(async () => { throw new Error(await panel.locator("[data-contact-status]").innerText()); }),
  ]);
  checks++;
  const pending = page.waitForEvent("download");
  await panel.getByRole("link", { name: "Scarica ZIP con PNG e manifest" }).click();
  const download = await pending;
  assert.equal(download.suggestedFilename(), "video-context.zip");
  const archive = unzipSync(new Uint8Array(await readFile(await download.path())));
  assert.deepEqual(Object.keys(archive), ["contact-sheet.png", "frame-01.png", "frame-02.png", "frame-03.png", "frame-04.png", "manifest.json"]);
  checks += 2;
  const manifest = JSON.parse(Buffer.from(archive["manifest.json"]).toString("utf8"));
  assert.equal(manifest.schema, "strumentini-video-contact-sheet/v1");
  assert.equal(manifest.generatedInterpretation, null);
  assert.equal(manifest.frames.length, 4);
  const source = await readFile(resolve(root, "tests/video-frame-305-red-green.mp4"));
  assert.equal(manifest.source.sha256, createHash("sha256").update(source).digest("hex"));
  checks += 4;
  const samples = [];
  for (let n = 0; n < 4; n++) {
    const record = manifest.frames[n];
    const bytes = archive[record.filename];
    assert.equal(createHash("sha256").update(bytes).digest("hex"), record.sha256);
    assert(Math.abs(record.requestedSeconds - record.presentedSeconds) <= 0.16);
    const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [64, 48]);
    const offset = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
    samples.push([data[offset], data[offset + 1], data[offset + 2]]);
    checks += 3;
  }
  assert(samples[0][0] > 170 && samples[0][1] < 80, "Earlier frame red");
  assert(samples[3][1] > samples[3][0] * 1.7, "Later frame green");
  const png = await sharp(archive["contact-sheet.png"]).metadata();
  assert.deepEqual([png.width, png.height], [640, 460]);
  checks += 3;
  // An invalid export replaces the previous result rather than leaving a stale downloadable ZIP.
  await panel.getByRole("spinbutton", { name: "Fotogrammi (2–8)" }).fill("9");
  await panel.getByRole("button", { name: "Genera contact sheet e ZIP" }).click();
  await panel.locator("[data-contact-status]").getByText(/VIDEO_CONTACT_COUNT/).waitFor({ timeout: 10_000 });
  assert.equal(await panel.locator("[data-contact-result]").count(), 0);
  checks += 2;
  assert.deepEqual(errors, []);
  assert.deepEqual(offsite, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  checks += 3;
  console.log(`#308 contact sheet: PASS ${checks} checks; real MP4 decoded, verified presented timestamps, ZIP/manifest/png re-opened, no offsite`);
} finally {
  if (browser) await browser.close();
  server?.kill("SIGTERM");
}
