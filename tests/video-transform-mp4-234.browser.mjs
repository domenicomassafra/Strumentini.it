// Real Chromium WebCodecs encode + MP4 mux, inspected by independent FFprobe.
import { strict as assert } from "node:assert";
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const sourceName = process.env.VIDEO234_SOURCE === "webm"
  ? "tests/video-vp8-opus-234.webm" : "tests/video-audio-234-two-tones.mp4";
const origin = (process.env.VIDEO234_ORIGIN ?? "http://127.0.0.1:18534").replace(/\/$/u, "");
const server = process.env.VIDEO234_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"), [
  "dev", "--host", "127.0.0.1", "--port", "18534", "--ignore-lock",
], { cwd: root, stdio: "ignore" });
let browser;
let checks = 0;
try {
  let up = false;
  for (let n = 0; n < 140; n++) {
    try { if ((await fetch(`${origin}/tools/video-inspector/`)).ok) { up = true; break; } } catch { /* dev server */ }
    await new Promise(done => setTimeout(done, 120));
  }
  assert(up, "Video inspector route must be available");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__video234Workers = { created: 0, terminated: 0 };
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); window.__video234Workers.created++; }
      terminate() { window.__video234Workers.terminated++; return super.terminate(); }
    };
  });
  const offsite = [];
  const jsErrors = [];
  page.on("pageerror", error => jsErrors.push(error.message));
  page.on("request", request => {
    if ((!request.url().startsWith(origin) && !/^(data:|blob:)/u.test(request.url())) || request.method() !== "GET") {
      offsite.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.goto(`${origin}/tools/video-inspector/`, { waitUntil: "networkidle" });
  const frame = page.locator("[data-video-frame-camera-305]");
  await frame.locator('input[type="file"]').setInputFiles(resolve(root, sourceName));
  await frame.getByText(/Sorgente:/u).waitFor();
  const tool = page.locator("[data-video-transform-234]");
  await tool.waitFor();
  assert.match(await tool.innerText(), /H.264|WebCodecs/u);
  checks++;
  await tool.getByRole("button", { name: "Verifica encoder WebCodecs" }).click();
  await page.waitForTimeout(7000);
  console.log("VIDEO234_CAPABILITY_PROBE", await tool.locator("[data-video-transform-capability]").innerText());
  await tool.locator("[data-video-transform-capability]").getByText(/verificate|Non disponibili|WebCodecs|VIDEO_234_|Decoder|Encoder|non supportati/iu).waitFor({ timeout: 30_000 });
  const capability = await tool.locator("[data-video-transform-capability]").innerText();
  assert.match(capability, /verificate/u, `WebCodecs AVC+AAC encoder missing: ${capability}`);
  checks++;
  await tool.getByRole("spinbutton", { name: "Inizio video (s)" }).fill("0.25");
  await tool.getByRole("spinbutton", { name: /Fine video/u }).fill("1.75");
  await tool.getByRole("spinbutton", { name: /Larghezza codificata/u }).fill("64");
  await tool.getByRole("spinbutton", { name: /Altezza codificata/u }).fill("48");
  await tool.getByRole("button", { name: "Verifica encoder WebCodecs" }).click();
  await tool.locator("[data-video-transform-capability]").getByText(/verificate/u).waitFor({ timeout: 20_000 });
  await tool.getByRole("spinbutton", { name: /Bitrate video obiettivo/u }).fill("350");
  await tool.getByRole("button", { name: "Genera MP4 H.264 + AAC" }).click();
  await page.waitForTimeout(7000);
  console.log("VIDEO234_BROWSER_PROGRESS", await tool.locator("[data-video-transform-status]").innerText());
  const interim = await tool.locator("[data-video-transform-status]").innerText();
  if (!/^(WebCodecs:|Codifica H\.264\+AAC:|Nuovo MP4)/u.test(interim)) throw Error(`Encoder exited early: ${interim}`);
  await Promise.race([
    tool.locator("[data-video-transform-result]").waitFor({ timeout: 75_000 }),
    tool.locator("[data-video-transform-status]").getByText(/VIDEO_234_|WebCodecs.*non|Worker.*non/u).waitFor({ timeout: 75_000 })
      .then(async () => { throw new Error(await tool.locator("[data-video-transform-status]").innerText()); }),
  ]);
  checks++;
  const [download] = await Promise.all([page.waitForEvent("download"), tool.getByRole("link", { name: "Scarica MP4 ricodificato" }).click()]);
  assert.equal(download.suggestedFilename(), "video-ricodificato.mp4");
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(4, 8).toString(), "ftyp");
  checks += 2;
  const report = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
    "stream=codec_name,codec_type,start_time,duration,width,height,sample_rate,channels:format=duration,size",
    "-of", "json", await download.path()], { encoding: "utf8" }));
  const video = report.streams.find(item => item.codec_type === "video");
  const audio = report.streams.find(item => item.codec_type === "audio");
  assert.equal(report.streams.length, 2);
  assert.equal(video?.codec_name, "h264");
  assert.equal(audio?.codec_name, "aac");
  assert.deepEqual([video.width, video.height], [64, 48]);
  const dur = Number(report.format.duration);
  assert(Math.abs(dur - 1.5) <= 0.18, `output duration ${dur}`);
  assert(Math.abs(Number(audio.start_time) - Number(video.start_time)) <= 0.12,
    `A/V streams not synchronized: ${JSON.stringify(report.streams)}`);
  assert(Math.abs(Number(audio.duration) - Number(video.duration)) <= 0.18);
  checks += 7;
  if (process.env.VIDEO234_SOURCE !== "webm") {
    // Decode the ACTUAL newly encoded AAC with independent FFmpeg. Distinct
    // tones prove the selected 0.25–1.75s range retained both sound regions.
    const pcm = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", await download.path(),
      "-map", "0:a:0", "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"], { maxBuffer: 2 * 1024 * 1024 });
    const estimatedHz = (start, end) => {
      let crossings = 0;
      let previous = pcm.readFloatLE(Math.round(start * 48_000) * 4);
      for (let i = Math.round(start * 48_000) + 1; i < Math.round(end * 48_000); i++) {
        const value = pcm.readFloatLE(i * 4);
        if (previous < 0 && value >= 0) crossings++;
        previous = value;
      }
      return crossings / (end - start);
    };
    const firstHz = estimatedHz(0.15, 0.4);
    const secondHz = estimatedHz(1.05, 1.3);
    assert(Math.abs(firstHz - 440) <= 15, `First original 440Hz tone missing: ${firstHz}`);
    assert(Math.abs(secondHz - 880) <= 20, `Second original 880Hz tone missing: ${secondHz}`);
    checks += 2;
  }

  // Cancel an actual running encoder via user action, verify no stale MP4,
  // and retry immediately, without ever publishing the cancelled bytes.
  await tool.getByRole("button", { name: "Genera MP4 H.264 + AAC" }).click();
  await tool.getByRole("button", { name: "Annulla conversione" }).click();
  await tool.locator("[data-video-transform-status]").getByText(/VIDEO_234_CANCELLED/).waitFor();
  assert.equal(await tool.locator("[data-video-transform-result]").count(), 0);
  await page.waitForTimeout(250);
  assert.equal(await tool.locator("[data-video-transform-result]").count(), 0);
  checks += 3;
  await tool.getByRole("button", { name: "Genera MP4 H.264 + AAC" }).click();
  await tool.locator("[data-video-transform-result]").waitFor({ timeout: 55_000 });
  checks++;
  const stopped = await page.evaluate(() => window.__video234Workers);
  assert(stopped.created >= 5, `Too few Web Workers exercised: ${JSON.stringify(stopped)}`);
  assert.equal(stopped.created, stopped.terminated, `Web Worker leaked after conversion/cancel/retry: ${JSON.stringify(stopped)}`);
  checks += 2;
  assert.deepEqual(offsite, []);
  assert.deepEqual(jsErrors, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  checks += 3;
  console.log(`VIDEO234_REAL_MP4_ENCODER_PASS source=${sourceName} checks=${checks} bytes=${bytes.length} duration=${dur} video=${video.codec_name} audio=${audio.codec_name} start_delta=${Math.abs(Number(audio.start_time)-Number(video.start_time))}`);
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
