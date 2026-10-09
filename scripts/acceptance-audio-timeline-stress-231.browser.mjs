/**
 * #231 near-budget real Chromium local PCM16/Worker stress, not physical device QA.
 * 60 seconds, 48kHz stereo, 11.52MB genuine PCM16 WAV, actual downloaded output
 * reopened by ffprobe. Asserts 0.5x oversized output refusal and a real Worker
 * cancellation before any partial download. No heap-peak/physical-mobile claim.
 * AUDIO231_STRESS_DIST=path/to/clean/dist AUDIO231_STRESS_PORT=18574
 */
import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(process.env.AUDIO231_STRESS_DIST ?? join(root, "dist"));
const port = Number(process.env.AUDIO231_STRESS_PORT ?? 18574);
assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
assert(existsSync(join(dist, "tools/audio-generator/index.html")));
const temp = mkdtempSync(join(tmpdir(), "audio231-stress-"));
const wavPath = join(temp, "60seconds-48k-stereo.wav");
const frames = 48_000 * 60;
const wav = Buffer.alloc(44 + frames * 4);
wav.write("RIFF", 0, "ascii"); wav.writeUInt32LE(wav.byteLength - 8, 4);
wav.write("WAVEfmt ", 8, "ascii"); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(48_000, 24); wav.writeUInt32LE(48_000 * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36, "ascii"); wav.writeUInt32LE(frames * 4, 40);
for (let i = 0; i < frames; i++) {
  const sample = i % 500 < 250 ? 4000 : -4000;
  wav.writeInt16LE(sample, 44 + i * 4);
  wav.writeInt16LE(-sample, 46 + i * 4);
}
writeFileSync(wavPath, wav);
assert(wav.byteLength < 12 * 1024 * 1024);

const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist],
  { cwd: root, stdio: "ignore" });
async function waitLocal() {
  for (let i = 0; i < 75; i++) {
    try { if ((await fetch(`${origin}/tools/audio-generator/`)).status === 200) return; } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Static browser server did not start");
}
let browser;
let context;
try {
  await waitLocal();
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await context.addInitScript(() => {
    const NativeWorker = window.Worker;
    const state = { constructed: 0, terminated: 0, sent: 0, revoked: 0 };
    window.__audio231Stress = state;
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (...args) => { state.revoked++; return revoke(...args); };
    window.Worker = class extends NativeWorker {
      constructor(url, options) { super(url, options); this.__mine = String(url).includes("231"); if (this.__mine) state.constructed++; }
      postMessage(message, ...rest) { if (this.__mine && message?.kind === "render") state.sent++; return super.postMessage(message, ...rest); }
      terminate() { if (this.__mine) state.terminated++; return super.terminate(); }
    };
  });
  const page = await context.newPage();
  const pageErrors = [];
  const offsite = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.route("**/*", (route) => {
    const address = route.request().url();
    if (address.startsWith(origin + "/") || address.startsWith("blob:") || address.startsWith("data:")) return route.continue();
    offsite.push(address); return route.abort();
  });
  await page.goto(`${origin}/tools/audio-generator/`, { waitUntil: "networkidle" });
  const panel = page.locator("[data-audio-timeline-231]");
  await panel.waitFor();
  await panel.locator('input[type="file"]').setInputFiles(wavPath);
  const started = Date.now();
  await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
  await panel.locator("[data-audio-timeline-result]").waitFor({ timeout: 60000 });
  const wallMs = Date.now() - started;
  const downloadWait = page.waitForEvent("download");
  await panel.getByRole("link", { name: "Scarica WAV PCM16 verificato" }).click();
  const download = await downloadWait;
  const file = await download.path();
  const meta = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
    "stream=codec_name,sample_rate,channels:format=duration,size", "-of", "json", file], { encoding: "utf8", timeout: 12000 }));
  assert.equal(meta.streams[0].codec_name, "pcm_s16le");
  assert.equal(meta.streams[0].sample_rate, "48000");
  assert.equal(meta.streams[0].channels, 2);
  assert.equal(Number(meta.format.duration), 60);
  assert.equal(readFileSync(file).length, wav.byteLength);
  let state = await page.evaluate(() => ({ ...window.__audio231Stress }));
  assert.equal(state.constructed, 1); assert.equal(state.terminated, 1);

  // 0.5x would make a 120s, 23MB output: the worker MUST refuse rather than
  // return a partial 12MB WAV. The old result is revoked immediately.
  await panel.locator('input[type="number"]').nth(3).fill("0.5");
  assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0);
  await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
  await panel.locator("[data-audio-timeline-status]").getByText(/AUDIO_231_OUTPUT_LIMIT/u).waitFor({ timeout: 60000 });
  assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0);
  state = await page.evaluate(() => ({ ...window.__audio231Stress }));
  assert.equal(state.constructed, 2); assert.equal(state.terminated, 2);
  assert(state.revoked >= 1);

  // Real worker cancellation in a full-size job, with no mocked response.
  await panel.locator('input[type="number"]').nth(3).fill("1");
  await panel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
  await page.waitForFunction(() => window.__audio231Stress.sent >= 3, null, { timeout: 30000 });
  await panel.getByRole("button", { name: "Annulla montaggio" }).click();
  assert((await panel.locator("[data-audio-timeline-status]").innerText()).includes("AUDIO_231_CANCELLED"));
  assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0);
  state = await page.evaluate(() => ({ ...window.__audio231Stress }));
  assert.equal(state.constructed, 3); assert.equal(state.terminated, 3);
  assert.deepEqual(pageErrors, []); assert.deepEqual(offsite, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2));
  console.log(`AUDIO231_STRESS_BROWSER_PASS frames=${frames} sample_rate=48000 stereo=2 source_bytes=${wav.byteLength} output_bytes=${readFileSync(file).length} process_wall_ms=${wallMs} worker_constructed=${state.constructed} worker_terminated=${state.terminated} oversized_output_refused=true cancel_no_partial=true offsite=0`);
  await page.close();
} finally {
  await context?.close();
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
  rmSync(temp, { recursive: true, force: true });
}
