/** #234 — independent real-MP4/browser acceptance of the ONLY supported transform:
 * AAC/mp4a from nonfragmented MP4 -> local PCM16 WAV. No video encoder exists.
 * Tests exact browser download, ffprobe codec/length, audio tones, worker
 * termination on success/cancel/error, fail-closed source/range restrictions,
 * 390px viewport and no network outside a temporary loopback static server.
 *
 * No build/production writes. Optional: VIDEO234_BOUNDS_DIST, VIDEO234_BOUNDS_PORT,
 * VIDEO234_BOUNDS_BROWSERS=chromium[,firefox,webkit] (default Chromium only).
 */
import { chromium, firefox, webkit } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(process.env.VIDEO234_BOUNDS_DIST ?? resolve(root, "../Strumentini.it/dist"));
const source = resolve(root, "tests/video-audio-234-two-tones.mp4");
const muteSource = resolve(root, "tests/video-frame-305-red-green.mp4");
const port = Number(process.env.VIDEO234_BOUNDS_PORT ?? 18564);
const browsers = { chromium, firefox, webkit };
const requested = (process.env.VIDEO234_BOUNDS_BROWSERS ?? "chromium").split(",").map((v) => v.trim());
assert(Number.isInteger(port) && port > 1023 && port <= 65535, "Invalid isolated HTTP port");
assert(requested.length > 0 && requested.every((name) => Object.hasOwn(browsers, name)), "Invalid browser selection");
assert(existsSync(join(dist, "tools/video-inspector/index.html")), "No current static video-inspector page; refusing a phantom browser PASS");
assert(existsSync(source) && existsSync(muteSource), "Real local MP4 fixtures missing");
const origin = `http://127.0.0.1:${port}`;
const probe = (file) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
  "stream=index,codec_type,codec_name,width,height,sample_rate,channels:format=duration,size,format_name", "-of", "json", file],
{ encoding: "utf8", timeout: 10000 }));

const sourceInfo = probe(source);
assert.equal(sourceInfo.streams.filter((s) => s.codec_type === "video").length, 1);
assert.equal(sourceInfo.streams.filter((s) => s.codec_type === "audio").length, 1);
assert.equal(sourceInfo.streams.find((s) => s.codec_type === "video").codec_name, "h264");
assert.equal(sourceInfo.streams.find((s) => s.codec_type === "audio").codec_name, "aac");
assert.equal(sourceInfo.streams.find((s) => s.codec_type === "video").width, 64);
assert.equal(sourceInfo.streams.find((s) => s.codec_type === "video").height, 48);
assert(Math.abs(Number(sourceInfo.format.duration) - 2) < 0.01, "Expected independent 2s source");
assert.equal(probe(muteSource).streams.filter((s) => s.codec_type === "audio").length, 0);

function confirmDownloadedWav(bytes, downloadedPath, expectedFrequency) {
  const info = probe(downloadedPath);
  const audio = info.streams.filter((s) => s.codec_type === "audio");
  assert.equal(info.streams.filter((s) => s.codec_type === "video").length, 0, "Export must NOT claim a new video");
  assert.equal(audio.length, 1);
  assert.equal(audio[0].codec_name, "pcm_s16le", "Independent ffprobe must reopen genuine PCM16");
  assert.equal(Number(audio[0].sample_rate), 48_000);
  assert.equal(audio[0].channels, 1);
  assert(Math.abs(Number(info.format.duration) - 0.5) <= 1 / 48000, "Measured output is not a 500ms audio-only trim");
  assert.equal(bytes.length, 44 + 24000 * 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(40, true), 48000, "PCM data frames missing or wrong");
  let crossings = 0;
  let sumSquares = 0;
  let previous = view.getInt16(44 + 3600 * 2, true);
  for (let i = 3601; i < 20400; i += 1) {
    const sample = view.getInt16(44 + i * 2, true);
    if (previous <= 0 && sample > 0) crossings += 1;
    sumSquares += (sample / 32768) ** 2;
    previous = sample;
  }
  const measuredFrequency = crossings * 48000 / (20400 - 3600);
  assert(Math.abs(measuredFrequency - expectedFrequency) < 8, `${measuredFrequency} Hz instead of ${expectedFrequency} Hz`);
  assert(Math.sqrt(sumSquares / (20400 - 3600)) > 0.03, "Downloaded WAV is silent");
  return { sourceAudio: "aac", outputAudio: "pcm_s16le", outputVideoTracks: 0, hz: Math.round(measuredFrequency), samples: 24000, bytes: bytes.length };
}

async function waitForLocal() {
  for (let attempt = 0; attempt < 75; attempt += 1) {
    try { if ((await fetch(`${origin}/tools/video-inspector/`)).status === 200) return; } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Temporary static HTTP server failed to start");
}

const temp = mkdtempSync(join(tmpdir(), "video234-bounds-"));
const tooLarge = join(temp, "source-oversize.mp4");
const original = readFileSync(source);
// The picker allows up to 50 MiB, but #234 extraction MUST refuse >12 MiB
// before AudioContext decoding or Worker creation. A truly oversized local file.
const oversized = Buffer.alloc(12 * 1024 * 1024 + 1);
original.copy(oversized);
writeFileSync(tooLarge, oversized);
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist],
  { cwd: root, stdio: "ignore" });
let checks = 0;
try {
  await waitForLocal();
  for (const browserName of requested) {
    const browser = await browsers[browserName].launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
    try {
      // Instrument lifecycle without mocking decoding or writing on success.
      await context.addInitScript(() => {
        const NativeWorker = window.Worker;
        const NativeAudioContext = window.AudioContext;
        const closedContexts = new WeakSet();
        const state = { workerConstructed: 0, workerTerminated: 0, workerPosts: 0, audioContexts: 0,
          audioContextsClosed: 0, audioCloseAttempts: 0, dropNextWrite: false, failNextWrite: false, swallowed: 0 };
        window.__video234Lifecycle = state;
        if (NativeAudioContext) {
          window.AudioContext = class extends NativeAudioContext {
            constructor(...args) { super(...args); state.audioContexts += 1; }
            async close(...args) {
              state.audioCloseAttempts += 1;
              const result = await super.close(...args);
              if (this.state === "closed" && !closedContexts.has(this)) {
                closedContexts.add(this);
                state.audioContextsClosed += 1;
              }
              return result;
            }
          };
        }
        window.Worker = class extends NativeWorker {
          constructor(url, options) { super(url, options); if (String(url).includes("234")) { this.__is234 = true; state.workerConstructed += 1; } }
          postMessage(message, ...rest) {
            if (this.__is234 && message?.kind === "write") {
              state.workerPosts += 1;
              if (state.dropNextWrite) { state.dropNextWrite = false; state.swallowed += 1; return; }
              if (state.failNextWrite) { state.failNextWrite = false; state.swallowed += 1;
                queueMicrotask(() => this.dispatchEvent(new ErrorEvent("error", { message: "synthetic worker error for teardown proof" }))); return; }
            }
            return super.postMessage(message, ...rest);
          }
          terminate() { if (this.__is234) state.workerTerminated += 1; return super.terminate(); }
        };
      });
      const page = await context.newPage();
      const offsite = [];
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith(`${origin}/`) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
        offsite.push(url);
        return route.abort();
      });
      const response = await page.goto(`${origin}/tools/video-inspector/`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      const panel = page.locator("[data-video-audio-234]");
      const picker = page.locator("[data-video-frame-camera-305] input[type=file]");
      await panel.waitFor();
      const disclosure = await panel.innerText();
      for (const text of ["12 MiB", "60 s", "16 MiB", "nessun encoder video disponibile", "taglio/compressione del video", "non disponibili", "48 kHz"]) {
        assert(disclosure.toLowerCase().includes(text.toLowerCase()), `${browserName}: missing disclosure ${text}`);
      }
      checks += 7;
      await picker.setInputFiles(source);
      await page.locator("[data-video-frame-camera-305] video").first().evaluate((video) => new Promise((resolve, reject) => {
        if (video.readyState >= 1) return resolve();
        video.addEventListener("loadedmetadata", resolve, { once: true });
        video.addEventListener("error", reject, { once: true });
      }));
      const tones = [];
      for (const [start, end, hz] of [["0.25", "0.75", 440], ["1.25", "1.75", 880]]) {
        await panel.locator('input[type="number"]').nth(0).fill(start);
        await panel.locator('input[type="number"]').nth(1).fill(end);
        await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
        await panel.locator("[data-video-audio-result]").waitFor({ timeout: 25000 });
        const status = await panel.locator("[data-video-audio-status]").innerText();
        assert(status.includes("WAV verificato"));
        const downloading = page.waitForEvent("download");
        await panel.getByRole("link", { name: "Scarica WAV PCM16" }).click();
        const download = await downloading;
        assert.equal(download.suggestedFilename(), "audio-estratto.wav");
        const file = await download.path();
        const bytes = readFileSync(file);
        tones.push(confirmDownloadedWav(bytes, file, hz));
        checks += 13;
      }
      let state = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      assert(state.workerConstructed >= 2 && state.workerTerminated === state.workerConstructed,
        `${browserName}: Worker not terminated after successful download: ${JSON.stringify(state)}`);
      assert.equal(state.audioContextsClosed, state.audioContexts, "AudioContext not released after success");
      checks += 2;

      // An invalid range removes any previous downloadable artifact.
      await panel.locator('input[type="number"]').nth(0).fill("1.5");
      await panel.locator('input[type="number"]').nth(1).fill("0.5");
      await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
      await panel.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_RANGE/u).waitFor();
      assert.equal(await panel.locator("[data-video-audio-result]").count(), 0);
      checks += 2;

      await picker.setInputFiles(muteSource);
      await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
      await panel.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_CODEC_UNSUPPORTED/u).waitFor();
      assert.equal(await panel.locator("[data-video-audio-result]").count(), 0);
      checks += 2;

      state = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      await picker.setInputFiles(tooLarge);
      await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
      await panel.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_SOURCE_LIMIT/u).waitFor();
      assert.equal(await panel.locator("[data-video-audio-result]").count(), 0);
      const afterLimit = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      assert.equal(afterLimit.workerConstructed, state.workerConstructed, "Oversize source unexpectedly started a worker");
      assert.equal(afterLimit.audioContexts, state.audioContexts, "Oversize source unexpectedly decoded audio");
      checks += 4;

      // Deterministic cancel after creating a REAL Worker; intercept only its
      // next postMessage to hold it while testing the UI AbortSignal cleanup.
      await picker.setInputFiles(source);
      await panel.locator('input[type="number"]').nth(0).fill("0.25");
      await panel.locator('input[type="number"]').nth(1).fill("0.75");
      await page.evaluate(() => { window.__video234Lifecycle.dropNextWrite = true; });
      const beforeCancel = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
      await page.waitForFunction((count) => window.__video234Lifecycle.swallowed > count, beforeCancel.swallowed, { timeout: 25000 });
      await panel.getByRole("button", { name: "Annulla estrazione WAV" }).click();
      await panel.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_CANCELLED/u).waitFor();
      assert.equal(await panel.locator("[data-video-audio-result]").count(), 0);
      state = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      assert(state.workerConstructed > beforeCancel.workerConstructed && state.workerConstructed === state.workerTerminated,
        "Cancelled worker must terminate without output");
      // UI cancellation is synchronous; AudioContext.close() is asynchronous.
      // Wait for the actual close invocation before declaring a leak.
      await page.waitForFunction(() => window.__video234Lifecycle.audioContextsClosed === window.__video234Lifecycle.audioContexts,
        null, { timeout: 6000 });
      state = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      assert.equal(state.audioContexts, state.audioContextsClosed, "Cancelled AudioContext leaked");
      checks += 5;

      // Simulate a Worker runtime error with no successful WAV message. Worker
      // must be terminated and no partial output may appear.
      await page.evaluate(() => { window.__video234Lifecycle.failNextWrite = true; });
      const beforeError = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
      await page.waitForFunction((count) => window.__video234Lifecycle.swallowed > count, beforeError.swallowed, { timeout: 25000 });
      await panel.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_WORKER_FAILED/u).waitFor();
      assert.equal(await panel.locator("[data-video-audio-result]").count(), 0);
      await page.waitForFunction(() => window.__video234Lifecycle.audioContextsClosed === window.__video234Lifecycle.audioContexts,
        null, { timeout: 6000 });
      state = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      assert.equal(state.workerTerminated, state.workerConstructed, "Errored worker not terminated");
      assert.equal(state.audioContextsClosed, state.audioContexts, "AudioContext leaked after error");
      checks += 4;

      // Successfully retry after both cancel and error; verifies the UI can
      // clear stale abort state and create/finish a fresh real worker.
      await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
      await panel.locator("[data-video-audio-result]").waitFor({ timeout: 25000 });
      await page.waitForFunction(() => {
        const lifecycle = window.__video234Lifecycle;
        return lifecycle.workerConstructed === lifecycle.workerTerminated && lifecycle.audioContexts === lifecycle.audioContextsClosed;
      }, null, { timeout: 6000 });
      state = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      assert(state.workerConstructed >= 5, "Retry did not create and finish another real WAV Worker");
      checks += 1;

      // No hidden MediaRecorder/FFmpeg fallback: absence of the local Worker
      // must fail closed and revoke the preceding downloadable WAV.
      await page.evaluate(() => { window.Worker = undefined; });
      const beforeUnsupported = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      await panel.getByRole("button", { name: "Estrai WAV dal video" }).click();
      await panel.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_BROWSER_UNSUPPORTED/u).waitFor();
      assert.equal(await panel.locator("[data-video-audio-result]").count(), 0);
      state = await page.evaluate(() => ({ ...window.__video234Lifecycle }));
      assert.equal(state.workerConstructed, beforeUnsupported.workerConstructed);
      assert.equal(state.audioContexts, beforeUnsupported.audioContexts);
      checks += 3;

      assert.deepEqual(offsite, [], "Offsite network request observed");
      assert.deepEqual(pageErrors, [], "Uncaught browser errors observed");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2),
        "390px horizontal overflow");
      checks += 3;
      console.log(`${browserName} #234 browser PASS: ${JSON.stringify({ tones, lifecycles: state, checks, viewport: 390, offsite: 0 })}`);
      await page.close();
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`VIDEO234_BOUNDS_BROWSER_PASS checks=${checks} browsers=${requested.join(",")} source=real-mp4 ffprobe=confirmed trim=audio-only resize=unsupported video-transcode=unsupported`);
} finally {
  if (server.exitCode === null) server.kill("SIGTERM");
  rmSync(temp, { recursive: true, force: true });
}
