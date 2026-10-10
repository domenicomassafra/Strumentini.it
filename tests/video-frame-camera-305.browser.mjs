// Built static route, desktop Chromium 390px. Camera is a deliberate TEST MOCK;
// neither permission behavior on a physical camera nor exact hardware latency is certified.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const port = 18439;
const suppliedOrigin = process.env.VIDEO037_ORIGIN?.replace(/\/$/u, "");
const origin = suppliedOrigin ?? `http://127.0.0.1:${port}`;
const server = suppliedOrigin ? null : spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser;
let checks = 0;

async function sourcePixel(download) {
  const buffer = await readFile(await download.path());
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [64, 48]);
  const index = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
  checks += 2;
  return [data[index], data[index + 1], data[index + 2]];
}

try {
  let started = false;
  for (let n = 0; n < 90; n++) {
    try { started = (await fetch(`${origin}/tools/video-inspector/`)).ok; if (started) break; } catch { /* waiting for local server */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(started, "Built page must serve 200");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const external = [];
  const errors = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("data:") && !request.url().startsWith("blob:")) external.push(request.url());
    if (request.method() !== "GET") external.push(`${request.method()} ${request.url()}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    // Deterministic mock camera with a real canvas capture MediaStream.
    window.__testCamera = { calls: 0, stopCount: 0, denyNext: true, stream: null };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async (constraints) => {
        window.__testCamera.calls++;
        if (window.__testCamera.denyNext) { window.__testCamera.denyNext = false; throw new DOMException("Permission denied", "NotAllowedError"); }
        if (constraints.audio !== false || constraints.video !== true) throw Error("Unsafe camera constraints");
        const canvas = document.createElement("canvas");
        canvas.width = 32; canvas.height = 24;
        canvas.getContext("2d").fillRect(0, 0, 32, 24);
        const stream = canvas.captureStream(10);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => { window.__testCamera.stopCount++; stop(); };
        }
        window.__testCamera.stream = stream;
        return stream;
      },
    } });
  });
  await page.goto(`${origin}/tools/video-inspector/`, { waitUntil: "networkidle" });
  const panel = page.locator("[data-video-frame-camera-305]");
  await panel.waitFor();
  assert.equal(await page.evaluate(() => window.__testCamera.calls), 0);
  checks++;
  await panel.locator('input[type="file"]').setInputFiles(resolve(root, "tests/video-frame-305-red-green.mp4"));
  await panel.getByText(/durata dichiarata/iu).waitFor();
  checks++;

  for (const [seconds, color] of [["0.25", "red"], ["1.5", "green"]]) {
    await panel.getByRole("spinbutton", { name: "Timestamp richiesto, secondi" }).fill(seconds);
    await panel.getByRole("button", { name: "Estrai fotogramma PNG" }).click();
    await panel.locator("[data-frame-result]").waitFor({ timeout: 15_000 });
    const result = await panel.locator("[data-frame-result]").innerText();
    assert.match(result, /Richiesto: /u);
    assert.match(result, /Timestamp di presentazione|Timestamp effettivo non verificabile/u);
    const pending = page.waitForEvent("download");
    await panel.getByRole("link", { name: "Scarica fotogramma PNG" }).click();
    const download = await pending;
    assert.match(download.suggestedFilename(), /\.png$/u);
    const [r, g, b] = await sourcePixel(download);
    if (color === "red") assert(r > 170 && g < 80 && b < 80, `Expected red: ${r},${g},${b}`);
    else assert(g > 60 && g > r * 1.7 && g > b * 1.7, `Expected green: ${r},${g},${b}`);
    checks += 4;
  }
  await panel.getByRole("spinbutton", { name: "Timestamp richiesto, secondi" }).fill("2");
  await panel.getByRole("button", { name: "Estrai fotogramma PNG" }).click();
  await panel.locator("[data-frame-status]").getByText(/VIDEO_FRAME_RANGE/u).waitFor();
  assert.equal(await panel.locator("[data-frame-result]").count(), 0);
  checks += 2;

  assert.equal(await page.evaluate(() => window.__testCamera.calls), 0);
  await panel.getByRole("button", { name: "Attiva camera", exact: true }).click();
  await panel.locator("[data-camera-status]").getByText(/permesso negato/u).waitFor();
  assert.equal(await page.evaluate(() => window.__testCamera.calls), 1);
  checks += 2;
  await panel.getByRole("button", { name: "Attiva camera", exact: true }).click();
  await panel.locator("[data-camera-status]").getByText(/Camera attiva localmente/u).waitFor();
  assert.equal(await page.evaluate(() => window.__testCamera.calls), 2);
  // Browser-led permission/device revocation must clean up local tracks and
  // recover to a state in which explicit user retry is possible.
  await page.evaluate(() => window.__testCamera.stream.getTracks()[0].dispatchEvent(new Event("ended")));
  await panel.locator("[data-camera-status]").getByText(/tracce locali rilasciate/u).waitFor();
  assert(await panel.getByRole("button", { name: "Attiva camera", exact: true }).isEnabled());
  await panel.getByRole("button", { name: "Attiva camera", exact: true }).click();
  await panel.locator("[data-camera-status]").getByText(/Camera attiva localmente/u).waitFor();
  assert.equal(await page.evaluate(() => window.__testCamera.calls), 3);
  checks += 3;
  await panel.getByRole("button", { name: "Disattiva camera" }).click();
  await panel.locator("[data-camera-status]").getByText(/tracce locali rilasciate/u).waitFor();
  assert((await page.evaluate(() => window.__testCamera.stopCount)) >= 1);
  checks += 3;

  // Regression: browser preview play() can remain pending after getUserMedia
  // resolves. An explicit stop must invalidate a late play() completion.
  await page.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    window.__cameraPlayRace = { resolve: null, held: false, rejectNext: false };
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.getAttribute("aria-label") === "Anteprima webcam locale") {
        if (window.__cameraPlayRace.rejectNext) {
          window.__cameraPlayRace.rejectNext = false;
          return Promise.reject(new DOMException("Playback refused", "NotAllowedError"));
        }
        if (!window.__cameraPlayRace.held) {
          window.__cameraPlayRace.held = true;
          return new Promise(resolve => { window.__cameraPlayRace.resolve = resolve; });
        }
      }
      return original.apply(this, args);
    };
  });
  await panel.getByRole("button", { name: "Attiva camera", exact: true }).click();
  await page.waitForFunction(() => typeof window.__cameraPlayRace.resolve === "function");
  assert((await panel.locator("[data-camera-status]").innerText()).includes("corso"));
  await panel.getByRole("button", { name: "Disattiva camera" }).click();
  await panel.locator("[data-camera-status]").getByText(/tracce locali rilasciate/u).waitFor();
  await page.evaluate(() => window.__cameraPlayRace.resolve());
  await page.waitForTimeout(100);
  assert.match(await panel.locator("[data-camera-status]").innerText(), /tracce locali rilasciate/u,
    "Stopped preview was revived by stale play() resolution");
  assert(await panel.getByRole("button", { name: "Attiva camera", exact: true }).isEnabled(),
    "Late play() must not re-disable the start button");
  assert.equal(await panel.getByLabel("Anteprima webcam locale").evaluate(video => video.srcObject), null);
  checks += 4;
  await panel.getByRole("button", { name: "Attiva camera", exact: true }).click();
  await panel.locator("[data-camera-status]").getByText(/Camera attiva localmente/u).waitFor();
  await panel.getByRole("button", { name: "Disattiva camera" }).click();
  await panel.locator("[data-camera-status]").getByText(/tracce locali rilasciate/u).waitFor();
  checks += 2;
  // Permission alone is insufficient: playback rejection must never be
  // reported as an active, visible preview, and allocated tracks must stop.
  await page.evaluate(() => { window.__cameraPlayRace.rejectNext = true; });
  const beforeRejectedStopCount = await page.evaluate(() => window.__testCamera.stopCount);
  await panel.getByRole("button", { name: "Attiva camera", exact: true }).click();
  await panel.locator("[data-camera-status]").getByText(/NotAllowedError/u).waitFor();
  assert(await panel.getByRole("button", { name: "Attiva camera", exact: true }).isEnabled());
  assert((await page.evaluate(() => window.__testCamera.stopCount)) > beforeRejectedStopCount,
    "Preview playback refusal must release all local tracks");
  assert.equal(await panel.getByLabel("Anteprima webcam locale").evaluate(video => video.srcObject), null);
  checks += 4;

  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  checks += 3;
  console.log(`Video frames and webcam opt-in (MOCK camera) acceptance: PASS (${checks} checks), offline red/green video 2 frames, no offsite requests`);
} finally {
  if (browser) await browser.close();
  server?.kill("SIGTERM");
}
