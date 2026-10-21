/** STR-424 compiled browser acceptance; output independently reopened with ffprobe/ffmpeg. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(process.env.AUDIO424_DIST ?? join(root, "dist"));
const port = Number(process.env.AUDIO424_PORT ?? 18624);
const origin = process.env.AUDIO424_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.AUDIO424_ORIGIN ? null : spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { cwd: root, stdio: "ignore" });
const temp = mkdtempSync(join(tmpdir(), "audio-424-"));
const kinds = { chromium, firefox, webkit };
const browsers = (process.env.AUDIO424_BROWSERS ?? "chromium,firefox,webkit").split(",");
let checks = 0;

function wave(seconds = 3) {
  const rate = 48_000;
  const frames = Math.floor(seconds * rate);
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVE", 8); bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) {
    const sample = Math.round(Math.sin(i * 2 * Math.PI * 440 / rate) * 0.3 * 32767);
    bytes.writeInt16LE(sample, 44 + i * 2);
  }
  return bytes;
}

const input = join(temp, "tone-440.wav");
writeFileSync(input, wave());

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + "/tools/audio-generator/")).ok) { ready = true; break; } }
    catch { /* server may still be starting */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(ready, "Compiled /tools/audio-generator/ route is missing");
  for (const name of browsers) {
    assert(Object.hasOwn(kinds, name));
    const browser = await kinds[name].launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      const errors = [];
      const outside = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (req) => {
        if (!req.url().startsWith(origin) && !req.url().startsWith("blob:") && !req.url().startsWith("data:")) outside.push(req.url());
      });
      await page.goto(origin + "/tools/audio-generator/", { waitUntil: "networkidle" });
      const panel = page.locator("[data-audio-transcode-424]");
      await panel.waitFor();
      const formats = await panel.locator("select").first().locator("option:not([disabled])").allTextContents();
      if (formats.length === 0) {
        assert.match(await panel.locator('[role="alert"]').innerText(), /AUDIO_424_ENCODER_UNSUPPORTED/);
        assert(await panel.getByRole("button", { name: "Comprimi audio" }).isDisabled());
        checks += 2;
        if (name === "chromium") throw new Error("Chromium native audio encoder absent: cannot test core capability");
        console.log(`STR-424 ${name}: NO_GO native codec; refused without fake output`);
        continue;
      }
      await panel.locator("input[type=file]").setInputFiles(input);
      await panel.getByLabel("Qualità richiesta · kbps").selectOption("48");
      await panel.getByRole("button", { name: "Comprimi audio" }).click();
      await panel.locator("[data-audio-424-result]").waitFor({ timeout: 30_000 });
      const receipt = await panel.locator("[data-audio-424-result]").innerText();
      assert.match(receipt, /48 kbps/);
      assert.match(receipt, /Bitrate medio reale/);
      assert.match(receipt, /Risparmio misurato/);
      checks += 3;
      const getting = page.waitForEvent("download");
      await panel.getByRole("link", { name: "Scarica audio verificato" }).click();
      const download = await getting;
      const raw = readFileSync(await download.path());
      assert(raw.length < readFileSync(input).length, `Expected compression: ${raw.length} bytes`);
      const path = join(temp, `${name}-${download.suggestedFilename()}`);
      writeFileSync(path, raw);
      const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,channels:format=duration,size", "-of", "json", path], { encoding: "utf8" }));
      assert(["opus", "aac"].includes(probe.streams?.[0]?.codec_name), JSON.stringify(probe));
      assert([1, 2].includes(probe.streams?.[0]?.channels), "Expected a playable mono/stereo output");
      assert.equal(Number(probe.format.size), raw.length);
      checks += 4;
      // Decode through an entirely separate process and measure a real 440Hz signal.
      const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", path, "-f", "f32le", "-ar", "48000", "-ac", "1", "-"], { maxBuffer: 3 * 1024 * 1024 });
      const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.length);
      const samples = Math.floor(pcm.length / 4);
      assert(Math.abs(samples / 48_000 - 3) < 0.5, `Wrong independently decoded duration: ${samples / 48_000}`);
      let crossings = 0; let power = 0;
      const start = Math.floor(samples * 0.2);
      const stop = Math.floor(samples * 0.8);
      for (let i = start + 1; i < stop; i++) {
        const previous = view.getFloat32((i - 1) * 4, true);
        const current = view.getFloat32(i * 4, true);
        if (previous <= 0 && current > 0) crossings++;
        power += current * current;
      }
      const frequency = crossings * 48_000 / (stop - start);
      const rms = Math.sqrt(power / (stop - start));
      assert(Math.abs(frequency - 440) < 12, `Wrong decoded frequency: ${frequency}`);
      assert(rms > 0.03, `Audio signal disappeared: ${rms}`);
      checks += 3;
      await panel.getByLabel("Qualità richiesta · kbps").selectOption("64");
      assert.equal(await panel.locator("[data-audio-424-result]").count(), 0, "Stale output still downloadable after settings change");
      checks++;
      await panel.getByRole("button", { name: "Comprimi audio" }).click();
      await panel.getByRole("button", { name: "Annulla" }).click();
      await page.waitForTimeout(150);
      assert.equal(await panel.locator("[data-audio-424-result]").count(), 0, "Cancel leaked an output");
      checks++;
      assert.deepEqual(errors, []);
      assert.deepEqual(outside, []);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      checks += 3;
      console.log(`STR-424 ${name}: PASS ${probe.streams[0].codec_name}, ${raw.length} bytes, ${frequency.toFixed(2)}Hz, RMS ${rms.toFixed(3)}`);
    } finally { await browser.close(); }
  }
  console.log(`STR-424 PASS ${checks} real-browser/independent-playback checks; emulator/physical devices NOT_RUN`);
} finally {
  server?.kill("SIGTERM");
  rmSync(temp, { recursive: true, force: true });
}
