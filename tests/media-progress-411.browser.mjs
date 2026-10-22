/** STR-411 built consumer Chromium acceptance. No physical mobile-device claim. */
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const port = 18711;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist],
  { cwd: root, stdio: "ignore" });
const temp = mkdtempSync(join(tmpdir(), "strumentini-411-"));
let browser;
try {
  const sampleRate = 48000;
  const channels = 2;
  const frames = sampleRate * 55;
  const wav = Buffer.alloc(44 + frames * channels * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVE", 8); wav.write("fmt ", 12); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * channels * 2, 28);
  wav.writeUInt16LE(channels * 2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < frames; i++) {
    const sample = Math.round(3500 * Math.sin(i * 2 * Math.PI * 440 / sampleRate));
    wav.writeInt16LE(sample, 44 + i * 4);
    wav.writeInt16LE(sample, 46 + i * 4);
  }
  const fixture = join(temp, "large-55s-stereo.wav");
  writeFileSync(fixture, wav);

  let ready = false;
  for (let i = 0; i < 120; i++) {
    try { ready = (await fetch(origin + "/tools/audio-generator/")).status === 200; } catch { /* waiting */ }
    if (ready) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  assert(ready, "Built local audio route unavailable");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errors = [];
  const outside = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) {
      outside.push(request.url());
    }
  });
  await page.goto(origin + "/tools/audio-generator/", { waitUntil: "networkidle" });
  const panel = page.locator("[data-audio-timeline-231]");
  await panel.waitFor();
  await panel.locator("input[type=file]").setInputFiles(fixture);

  // Fake a real pending FileReader in the browser; cancellation must actively abort it.
  await page.evaluate(() => {
    window.__read411 = { started: 0, aborted: 0 };
    window.__realFileReader411 = window.FileReader;
    window.FileReader = class {
      static LOADING = 1;
      readyState = 1;
      readAsArrayBuffer() { window.__read411.started++; }
      abort() { window.__read411.aborted++; this.onabort?.(new Event("abort")); }
    };
  });
  await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
  await page.waitForFunction(() => window.__read411.started === 1);
  await panel.getByRole("button", { name: "Annulla montaggio" }).click();
  assert.equal((await page.evaluate(() => window.__read411.aborted)), 1, "Pending reader was not stopped");
  assert((await panel.locator("[data-audio-timeline-status]").innerText()).includes("AUDIO_231_CANCELLED"));
  assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0, "Cancelled output was published");
  await page.evaluate(() => { window.FileReader = window.__realFileReader411; });

  await page.evaluate(() => {
    window.__progress411 = [];
    const element = document.querySelector("[data-audio-timeline-231]");
    new MutationObserver(() => {
      const wrapper = element.querySelector("[data-media-progress411]");
      const progress = wrapper?.querySelector("progress");
      if (progress) window.__progress411.push({
        value: Number(progress.value), max: Number(progress.max), text: wrapper.textContent.trim(),
      });
    }).observe(element, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["value", "max"] });
  });
  const begin = Date.now();
  await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
  await panel.locator("[data-audio-timeline-result]").waitFor({ timeout: 120000 });
  const elapsedMs = Date.now() - begin;
  const seen = await page.evaluate(() => window.__progress411);
  assert(seen.some((entry) => entry.max === wav.length && entry.value > 0 && entry.value <= wav.length),
    "No measured read progress on built consumer");
  assert(seen.some((entry) => entry.max === frames && entry.value > 0 && entry.value <= frames),
    "No frame-count progress on built consumer");
  const downloadWait = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Scarica WAV PCM16 verificato" }).click();
  const download = await downloadWait;
  const bytes = readFileSync(await download.path());
  const outputFile = join(temp, "output.wav");
  writeFileSync(outputFile, bytes);
  const metadata = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
    "stream=codec_name,channels,sample_rate:format=duration,size", "-of", "json", outputFile], { encoding: "utf8" }));
  assert.equal(metadata.streams[0].codec_name, "pcm_s16le");
  assert.equal(Number(metadata.streams[0].sample_rate), sampleRate);
  assert.equal(Number(metadata.streams[0].channels), channels);
  assert.equal(Number(metadata.format.duration), 55);
  assert.equal(bytes.length, wav.length);
  // MP4/AAC built consumer: cancel while metadata is still being read,
  // then observe genuine media bytes and PCM sample-frame progress.
  await page.goto(origin + "/tools/video-inspector/", { waitUntil: "networkidle" });
  const picker = page.locator("[data-video-frame-camera-305] input[type=file]");
  const videoPanel = page.locator("[data-video-audio-234]");
  await videoPanel.waitFor();
  await picker.setInputFiles(resolve(root, "tests/video-audio-234-two-tones.mp4"));
  await page.evaluate(() => {
    window.__read411 = { started: 0, aborted: 0 };
    window.__realFileReader411 = window.FileReader;
    window.FileReader = class {
      static LOADING = 1;
      readyState = 1;
      readAsArrayBuffer() { window.__read411.started++; }
      abort() { window.__read411.aborted++; this.onabort?.(new Event("abort")); }
    };
  });
  await videoPanel.getByRole("button", { name: "Estrai WAV dal video" }).click();
  await page.waitForFunction(() => window.__read411.started >= 1);
  await videoPanel.getByRole("button", { name: "Annulla estrazione WAV" }).click();
  assert.equal(await page.evaluate(() => window.__read411.aborted), 1, "MP4 metadata reader remained pending");
  assert((await videoPanel.locator("[data-video-audio-status]").innerText()).includes("VIDEO_AUDIO_CANCELLED"));
  assert.equal(await videoPanel.locator("[data-video-audio-result]").count(), 0);
  await page.evaluate(() => { window.FileReader = window.__realFileReader411; });

  await page.evaluate(() => {
    window.__videoProgress411 = [];
    const element = document.querySelector("[data-video-audio-234]");
    new MutationObserver(() => {
      const wrapper = element.querySelector("[data-media-progress411]");
      const progress = wrapper?.querySelector("progress");
      if (progress) window.__videoProgress411.push({
        value: Number(progress.value), max: Number(progress.max), text: wrapper.textContent.trim(),
      });
    }).observe(element, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["value", "max"] });
  });
  await videoPanel.getByRole("button", { name: "Estrai WAV dal video" }).click();
  await videoPanel.locator("[data-video-audio-result]").waitFor({ timeout: 60_000 });
  const videoSeen = await page.evaluate(() => window.__videoProgress411);
  const mp4Bytes = readFileSync(resolve(root, "tests/video-audio-234-two-tones.mp4")).length;
  assert(videoSeen.some((entry) => entry.max === mp4Bytes && entry.value === mp4Bytes),
    "No verified MP4 read progress on built consumer");
  assert(videoSeen.some((entry) => entry.text.includes("frame PCM scritti") && entry.value > 0),
    "No measured PCM output-frame progress on built consumer");
  const wavDownloadWait = page.waitForEvent("download");
  await videoPanel.getByRole("link", { name: "Scarica WAV PCM16" }).click();
  const audioDownloaded = readFileSync(await (await wavDownloadWait).path());
  assert.equal(audioDownloaded.subarray(0, 4).toString(), "RIFF");
  assert.equal(audioDownloaded.subarray(8, 12).toString(), "WAVE");

  await picker.setInputFiles(resolve(root, "tests/video-frame-305-red-green.mp4"));
  await videoPanel.getByRole("button", { name: "Estrai WAV dal video" }).click();
  await videoPanel.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_CODEC_UNSUPPORTED/u).waitFor({ timeout: 15_000 });
  assert.equal(await videoPanel.locator("[data-video-audio-result]").count(), 0, "Unsupported codec exposed stale output");

  // Contact-sheet consumer must report checked frames and a verified local hash-read.
  const contact = page.locator("[data-video-contact-sheet-308]");
  await contact.waitFor();
  await page.evaluate(() => {
    window.__contactProgress411 = [];
    const element = document.querySelector("[data-video-contact-sheet-308]");
    new MutationObserver(() => {
      const wrapper = element.querySelector("[data-media-progress411]");
      const progress = wrapper?.querySelector("progress");
      if (progress) window.__contactProgress411.push({
        value: Number(progress.value), max: Number(progress.max), text: wrapper.textContent.trim(),
      });
    }).observe(element, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["value", "max"] });
  });
  await contact.getByRole("button", { name: "Genera contact sheet e ZIP" }).click();
  await contact.locator("[data-contact-result]").waitFor({ timeout: 40_000 });
  const contactSeen = await page.evaluate(() => window.__contactProgress411);
  const frameFileBytes = readFileSync(resolve(root, "tests/video-frame-305-red-green.mp4")).length;
  assert(contactSeen.some((entry) => entry.max === frameFileBytes && entry.value === frameFileBytes),
    "Contact sheet did not count the hashed MP4 source bytes");
  assert(contactSeen.some((entry) => entry.text.includes("fotogrammi verificati") && entry.max === 4 && entry.value > 0),
    "Contact sheet did not count verified decoded frames");
  assert.deepEqual(errors, []);
  assert.deepEqual(outside, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  console.log("STR411_BROWSER_PASS", JSON.stringify({
    fixtureBytes: wav.length, outputBytes: bytes.length, elapsedMs,
    readEvents: seen.filter((entry) => entry.max === wav.length).length,
    frameEvents: seen.filter((entry) => entry.max === frames).length,
    injectedReaderAbort: 1, browser: "Chromium desktop 390px", physicalDevice: "NOT_RUN", offsite: 0,
  }));
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) server.kill("SIGTERM");
  rmSync(temp, { recursive: true, force: true });
}
