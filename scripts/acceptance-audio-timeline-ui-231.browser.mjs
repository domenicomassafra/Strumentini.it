/**
 * #231 opt-in real browser + real Worker PCM16/WAV editor acceptance.
 * Real 440Hz input, 2x output measured independently by ffprobe + PCM analysis.
 * Verifies waveform, download, stale-input revocation, cancel/terminate/retry,
 * forged RIFF, sample-layout mismatch, input ceiling, no offsite network.
 *
 * AUDIO231_BROWSERS=chromium,firefox,webkit (default chromium)
 * AUDIO231_DIST=path/to/clean/dist; AUDIO231_PORT=18573
 * This is desktop/headless acceptance, never physical iOS/Android evidence.
 */
import { chromium, firefox, webkit } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(process.env.AUDIO231_DIST ?? join(root, "dist"));
const names = (process.env.AUDIO231_BROWSERS ?? "chromium").split(",").map((v) => v.trim());
const browsers = { chromium, firefox, webkit };
const port = Number(process.env.AUDIO231_PORT ?? "18573");
assert(names.length > 0 && names.every((name) => Object.hasOwn(browsers, name)));
assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
assert(existsSync(join(dist, "tools/audio-generator/index.html")), "Static audio-generator route not built");
const origin = `http://127.0.0.1:${port}`;
const temp = mkdtempSync(join(tmpdir(), "strumentini-audio231-browser-"));

function wavSamples(rate, seconds, hz = 440) {
  const frames = Math.round(rate * seconds);
  const wav = Buffer.alloc(44 + frames * 2);
  const tag = (at, str) => wav.write(str, at, "ascii");
  tag(0, "RIFF"); wav.writeUInt32LE(wav.length - 8, 4);
  tag(8, "WAVE"); tag(12, "fmt "); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  tag(36, "data"); wav.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i += 1) {
    wav.writeInt16LE(Math.round(11000 * Math.sin(2 * Math.PI * hz * i / rate)), 44 + i * 2);
  }
  return wav;
}
function probeOutput(path, expectedFrames, expectedHz) {
  const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
    "stream=codec_name,channels,sample_rate:format=duration,size", "-of", "json", path], { encoding: "utf8" }));
  assert.equal(info.streams?.[0]?.codec_name, "pcm_s16le");
  assert.equal(info.streams[0].sample_rate, "8000");
  assert.equal(info.streams[0].channels, 1);
  const bytes = readFileSync(path);
  assert.equal(bytes.length, 44 + expectedFrames * 2);
  assert.equal(bytes.readUInt32LE(40), expectedFrames * 2);
  assert(Math.abs(Number(info.format.duration) - expectedFrames / 8000) < 1 / 8000);
  let crosses = 0;
  let energy = 0;
  for (let i = 1; i < expectedFrames; i += 1) {
    const value = bytes.readInt16LE(44 + i * 2);
    if (bytes.readInt16LE(44 + (i - 1) * 2) <= 0 && value > 0) crosses++;
    energy += value * value;
  }
  const hz = crosses * 8000 / expectedFrames;
  assert(Math.abs(hz - expectedHz) <= 8, `Output measured ${hz} Hz, expected ${expectedHz}`);
  assert(energy > 0, "Silent output should not pass the frequency probe");
  return { frames: expectedFrames, hz: Math.round(hz), codec: info.streams[0].codec_name, bytes: bytes.length };
}
function removedSilenceFramesFromSource(wav, threshold, minimumFrames) {
  const count = wav.readUInt32LE(40) / 2;
  let removed = 0;
  for (let i = 0; i < count;) {
    const quiet = Math.abs(wav.readInt16LE(44 + i * 2)) <= threshold;
    let end = i + 1;
    while (end < count && (Math.abs(wav.readInt16LE(44 + end * 2)) <= threshold) === quiet) end++;
    if (quiet && end - i >= minimumFrames) removed += end - i;
    i = end;
  }
  return removed;
}

const input = join(temp, "440hz-8khz.wav");
const second = join(temp, "660hz-8khz.wav");
const withSilence = join(temp, "silence-440hz.wav");
const mismatched = join(temp, "440hz-16khz.wav");
const forged = join(temp, "forged.wav");
const oversized = join(temp, "oversized.wav");
writeFileSync(input, wavSamples(8000, 1));
writeFileSync(second, wavSamples(8000, 0.5, 660));
const silent = wavSamples(8000, 1);
for (let frame = 1600; frame < 3200; frame += 1) silent.writeInt16LE(0, 44 + frame * 2);
writeFileSync(withSilence, silent);
writeFileSync(mismatched, wavSamples(16000, 0.3));
const fake = wavSamples(8000, 1); fake.writeUInt32LE(77777, 4);
writeFileSync(forged, fake);
writeFileSync(oversized, Buffer.alloc(12 * 1024 * 1024 + 1));
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist],
  { cwd: root, stdio: "ignore" });

async function waitLocal() {
  for (let i = 0; i < 70; i += 1) {
    try { if ((await fetch(`${origin}/tools/audio-generator/`)).status === 200) return; } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Local static server not serving built tool");
}
let checks = 0;
try {
  await waitLocal();
  for (const name of names) {
    const browser = await browsers[name].launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      await context.addInitScript(() => {
        const Original = window.Worker;
        const lifecycle = { created: 0, terminated: 0, sent: 0, held: 0, holdNext: false, revoked: 0 };
        window.__audio231Lifecycle = lifecycle;
        const originalRevoke = URL.revokeObjectURL.bind(URL);
        URL.revokeObjectURL = (...args) => { lifecycle.revoked++; return originalRevoke(...args); };
        window.Worker = class extends Original {
          constructor(url, options) { super(url, options); this.__audio231 = String(url).includes("231");
            if (this.__audio231) lifecycle.created++;
          }
          postMessage(message, ...rest) {
            if (this.__audio231 && message?.kind === "render") {
              lifecycle.sent++;
              if (lifecycle.holdNext) { lifecycle.holdNext = false; lifecycle.held++; return; }
            }
            return super.postMessage(message, ...rest);
          }
          terminate() { if (this.__audio231) lifecycle.terminated++; return super.terminate(); }
        };
      });
      const page = await context.newPage();
      const offsite = [];
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith(origin + "/") || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
        offsite.push(url);
        return route.abort();
      });
      const response = await page.goto(`${origin}/tools/audio-generator/`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      const panel = page.locator("[data-audio-timeline-231]");
      await panel.waitFor();
      const notice = await panel.innerText();
      for (const phrase of ["PCM16", "cambiare velocità modifica", "nessun caricamento sul server", "LUFS"]) {
        assert(notice.toLowerCase().includes(phrase.toLowerCase()), `Missing disclosure ${phrase}`);
      }
      checks += 5;
      const picker = panel.locator('input[type="file"]');
      const controls = panel.locator('input[type="number"]');
      await picker.setInputFiles(input);
      await controls.nth(0).fill("0.25");
      await controls.nth(1).fill("0.75");
      await controls.nth(3).fill("2");
      await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
      await panel.locator("[data-audio-timeline-result]").waitFor({ timeout: 20000 });
      assert((await panel.locator("[data-audio-timeline-status]").innerText()).includes("verificati"));
      assert.equal(await panel.locator("[data-audio-timeline-waveform] rect").count(), 192);
      const audio = panel.locator("audio");
      assert.equal(await audio.count(), 1);
      assert.equal(await audio.evaluate((element) => element.preload), "metadata");
      const waiter = page.waitForEvent("download");
      await panel.getByRole("link", { name: "Scarica WAV PCM16 verificato" }).click();
      const download = await waiter;
      assert.equal(download.suggestedFilename(), "montaggio-pcm16.wav");
      const trueWav = probeOutput(await download.path(), 2000, 880);
      let state = await page.evaluate(() => ({ ...window.__audio231Lifecycle }));
      assert.equal(state.created, state.terminated);
      assert.equal(state.created, 1);
      checks += 10;

      // Any new option must invalidate the old Blob URL and hide the result.
      await controls.nth(3).fill("1");
      assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0);
      state = await page.evaluate(() => ({ ...window.__audio231Lifecycle }));
      assert(state.revoked >= 1, "Previous WAV Blob URL was not revoked");
      checks += 2;

      // REAL Worker gets its postMessage intercepted exactly once; cancellation
      // must terminate it and a later retry must build a fresh worker.
      await page.evaluate(() => { window.__audio231Lifecycle.holdNext = true; });
      await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
      await page.waitForFunction(() => window.__audio231Lifecycle.held >= 1, null, { timeout: 20000 });
      await panel.getByRole("button", { name: "Annulla montaggio" }).click();
      assert((await panel.locator("[data-audio-timeline-status]").innerText()).includes("AUDIO_231_CANCELLED"));
      assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0);
      state = await page.evaluate(() => ({ ...window.__audio231Lifecycle }));
      assert.equal(state.created, state.terminated);
      checks += 4;
      await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
      await panel.locator("[data-audio-timeline-result]").waitFor({ timeout: 20000 });
      state = await page.evaluate(() => ({ ...window.__audio231Lifecycle }));
      assert.equal(state.created, state.terminated);
      assert.equal(state.created, 3);
      checks += 2;

      // Actual second-first order must produce independent 660Hz then 440Hz
      // samples, not just a preview label saying files were concatenated.
      await picker.setInputFiles([input, second]);
      await panel.locator('input[type="checkbox"]').first().check();
      await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
      await panel.locator("[data-audio-timeline-result]").waitFor({ timeout: 20000 });
      const mergeDownloadWait = page.waitForEvent("download");
      await panel.getByRole("link", { name: "Scarica WAV PCM16 verificato" }).click();
      const mergeDownload = await mergeDownloadWait;
      const mergePath = await mergeDownload.path();
      const mergeBytes = readFileSync(mergePath);
      // First file trimmed from .25s to .75s => 4000 frames, second => 4000.
      assert.equal(mergeBytes.readUInt32LE(40), 8000 * 2);
      const measureWindowHz = (fromFrame, frames) => {
        let crossings = 0;
        for (let frame = fromFrame + 1; frame < fromFrame + frames; frame++) {
          if (mergeBytes.readInt16LE(44 + (frame - 1) * 2) <= 0 &&
              mergeBytes.readInt16LE(44 + frame * 2) > 0) crossings++;
        }
        return crossings * 8000 / frames;
      };
      assert(Math.abs(measureWindowHz(300, 3200) - 660) < 8, "Second-first output did not begin with 660Hz samples");
      assert(Math.abs(measureWindowHz(4300, 3200) - 440) < 8, "Second-first output did not finish with 440Hz samples");
      checks += 4;

      // Silence removal and peak normalization must change the REAL exported
      // data and output size, without changing native WAV sample rate.
      await picker.setInputFiles(withSilence);
      await controls.nth(0).fill("0");
      await controls.nth(1).fill("");
      await panel.locator('input[type="checkbox"]').nth(1).check(); // normalize
      await panel.locator('input[type="checkbox"]').nth(2).check(); // silence
      await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
      await panel.locator("[data-audio-timeline-result]").waitFor({ timeout: 20000 });
      const notes = await panel.locator("[data-audio-timeline-result]").innerText();
      const expectedRemoved = removedSilenceFramesFromSource(readFileSync(withSilence), 10, 400);
      assert(expectedRemoved >= 1600, "Fixture did not contain the intended silence run");
      assert(notes.includes(`\n${expectedRemoved}\n`), `Independent silence run mismatch: ${notes}`);
      const silenceDownloadWait = page.waitForEvent("download");
      await panel.getByRole("link", { name: "Scarica WAV PCM16 verificato" }).click();
      const silenceDownload = await silenceDownloadWait;
      const silencePath = await silenceDownload.path();
      const silenceBytes = readFileSync(silencePath);
      const remaining = 8000 - expectedRemoved;
      assert.equal(silenceBytes.readUInt32LE(40), remaining * 2);
      assert.equal(Math.max(...Array.from({ length: remaining }, (_, i) => Math.abs(silenceBytes.readInt16LE(44 + i * 2)))), 24000);
      checks += 5;

      await picker.setInputFiles(forged);
      await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
      await panel.locator("[data-audio-timeline-status]").getByText(/AUDIO_231_INVALID_RIFF/u).waitFor();
      assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0);
      checks += 2;

      await picker.setInputFiles([input, mismatched]);
      await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
      await panel.locator("[data-audio-timeline-status]").getByText(/AUDIO_231_LAYOUT_MISMATCH/u).waitFor();
      assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0);
      checks += 2;

      state = await page.evaluate(() => ({ ...window.__audio231Lifecycle }));
      await picker.setInputFiles(oversized);
      assert((await panel.locator("[data-audio-timeline-status]").innerText()).includes("AUDIO_231_INPUT_LIMIT"));
      assert(await panel.getByRole("button", { name: "Elabora e mostra waveform" }).isDisabled());
      assert.equal((await page.evaluate(() => window.__audio231Lifecycle.created)), state.created);
      checks += 3;

      state = await page.evaluate(() => ({ ...window.__audio231Lifecycle }));
      assert.equal(state.created, state.terminated, "An audio job leaked a Worker");
      assert.deepEqual(offsite, []);
      assert.deepEqual(pageErrors, []);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2),
        "390px horizontal overflow");
      checks += 4;
      console.log(`${name} #231 browser PASS: ${JSON.stringify({ trueWav, lifecycle: state, checks, viewport: 390, offsite: 0 })}`);
      await page.close();
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`AUDIO231_TIMELINE_BROWSER_PASS checks=${checks} browsers=${names.join(",")} strict_pcm16=true pitch_changes=true no_offsite=true`);
} finally {
  if (server.exitCode === null) server.kill("SIGTERM");
  rmSync(temp, { recursive: true, force: true });
}
