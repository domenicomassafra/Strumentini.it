/** #272 actual MiniPC automation-browser, 390px; not physical phone evidence.
 * Run with Node26: node tests/image-exifr-272.browser.mjs
 * Connects to existing `automation-browser` CDP; never launches Chrome.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const origin = "http://127.0.0.1:19372";
// Built static artifact: avoid starting a Vite/optimizer process on the busy
// shared test host, and exercise exactly the lazy chunks emitted by `build`.
const server = spawn("python3", ["-m", "http.server", "19372", "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });

async function ready() {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode != null) throw Error(`Static server exited: ${server.exitCode}`);
    try { if ((await fetch(origin)).ok) return; } catch { /* Starting. */ }
    await delay(250);
  }
  throw Error("Static metadata viewer did not start");
}

await ready();
const browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
const remote = [];
const uploads = [];
const requests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  requests.push(request.url());
  if (!request.url().startsWith(origin)) remote.push(request.url());
  if (!["GET", "HEAD"].includes(request.method())) uploads.push(`${request.method()} ${request.url()}`);
});

try {
  await page.goto(`${origin}/tools/image-metadata-viewer/`, { waitUntil: "domcontentloaded" });
  const input = page.locator('form input[type="file"]').first();
  await input.waitFor();
  assert.equal(await page.locator("[data-gps-revealed-272]").count(), 0);
  assert.equal(requests.filter((url) => /exifr/i.test(url)).length, 0, "EXIF parser must be lazy before input");

  const run = async (name) => {
    await input.setInputFiles({
      name,
      mimeType: "image/jpeg",
      buffer: await readFile(`tests/fixtures/image-exifr-272/${name}`),
    });
    await page.locator('form button[type="submit"]').first().click();
    await page.locator('.result-panel [data-result-class="calculator"]').waitFor({ timeout: 30_000 });
  };

  await run("jpeg-gps-orientation.jpg");
  const panel = page.locator(".result-panel").first();
  await panel.getByText("Camera", { exact: true }).waitFor();
  await panel.getByText("TestCam", { exact: true }).waitFor();
  await panel.getByText("Rilevato · coordinate nascoste").waitFor();
  const privateGps = panel.locator("[data-gps-private-272]");
  assert.equal(await privateGps.count(), 1);
  assert.equal(await panel.locator("[data-gps-revealed-272]").count(), 0);
  assert.doesNotMatch(await panel.innerText(), /40\.5, 16\.916/u);
  await privateGps.getByRole("button", { name: "Mostra coordinate GPS" }).click();
  assert.match(await panel.locator("[data-gps-revealed-272]").innerText(), /40\.5, 16\.916/u);
  await privateGps.getByRole("button", { name: "Nascondi coordinate" }).click();
  assert.equal(await panel.locator("[data-gps-revealed-272]").count(), 0);

  // The public copy action must omit GPS even after deliberate reveal.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await panel.getByRole("button", { name: /Copia/i }).first().click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copied.includes('"cameraMake": "Camera"'), "copy payload must include verified camera");
  assert.ok(!copied.includes('"gps"') && !copied.includes("16.916"), "no GPS in copy JSON");

  await run("jpeg-icc-iptc.jpg");
  await panel.getByText("sRGB built-in", { exact: true }).waitFor();
  await panel.getByText("EXIFR 272 IPTC Title", { exact: true }).waitFor();
  assert.equal(await privateGps.count(), 0);
  assert.ok(requests.some((url) => /exifr/i.test(url)), "dynamic exifr import must load only on demand");
  assert.deepEqual(errors, []);
  assert.deepEqual(uploads, [], "image data must never be uploaded");
  assert.deepEqual(remote, [], "test must not call third-party endpoints");
  console.log("PASS #272 automation-browser Chrome 390x844: JPEG EXIF GPS default hidden/reveal/hide, safe JSON copy, positive ICC/IPTC, lazy exifr, no remote/upload/error; physical devices NOT_RUN");
} finally {
  await page.close();
  await context.close();
  server.kill("SIGTERM");
}
