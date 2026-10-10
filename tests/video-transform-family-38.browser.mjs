// Real local product compression receipts, independent FFprobe. Mobile viewport
// emulation is not physical phone/device acceptance.
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const origin = (process.env.VIDEO38_BASE ?? "http://127.0.0.1:18438").replace(/\/$/u, "");
const fixtures = [
  { path: "tests/video-audio-234-two-tones.mp4", originalVideo: "h264", originalAudio: "aac", label: "AVC", audioLabel: "AAC" },
  { path: "tests/video-vp8-opus-234.webm", originalVideo: "vp8", originalAudio: "opus", label: "VP8", audioLabel: "OPUS" },
];
let checks = 0;
let browser;
const probe = path => JSON.parse(execFileSync("ffprobe", [
  "-v", "error", "-show_entries", "format=size,duration:stream=codec_type,codec_name,width,height,start_time,duration",
  "-of", "json", path,
], { encoding: "utf8" }));

try {
  assert((await fetch(origin + "/tools/video-inspector/")).ok);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const offsite = [], errors = [];
  await page.addInitScript(() => {
    const Native = window.Worker;
    window.__video38Workers = { created: 0, terminated: 0 };
    window.Worker = class extends Native {
      constructor(...args) { super(...args); window.__video38Workers.created++; }
      terminate() { window.__video38Workers.terminated++; return super.terminate(); }
    };
  });
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.method() !== "GET" || (!request.url().startsWith(origin) && !/^(blob:|data:)/u.test(request.url()))) {
      offsite.push(request.method() + " " + request.url());
    }
  });
  assert.equal((await page.goto(origin + "/tools/video-inspector/", { waitUntil: "networkidle" })).status(), 200);
  const picker = page.locator("[data-video-frame-camera-305] input[type=file]");
  const panel = page.locator("[data-video-transform-234]");
  await panel.waitFor();
  checks++;
  for (const [index, fixture] of fixtures.entries()) {
    const originalPath = resolve(root, fixture.path);
    const originalSize = (await readFile(originalPath)).length;
    const original = probe(originalPath);
    assert.equal(original.streams.find(s => s.codec_type === "video").codec_name, fixture.originalVideo);
    assert.equal(original.streams.find(s => s.codec_type === "audio").codec_name, fixture.originalAudio);
    await picker.setInputFiles(originalPath);
    await page.getByText(/Sorgente:/u).first().waitFor();
    await panel.getByRole("spinbutton", { name: "Inizio video (s)" }).fill("0.25");
    await panel.getByRole("spinbutton", { name: /Fine video/u }).fill("1.75");
    await panel.getByRole("spinbutton", { name: /Larghezza codificata/u }).fill("64");
    await panel.getByRole("spinbutton", { name: /Altezza codificata/u }).fill("48");
    await panel.getByRole("button", { name: "Verifica encoder WebCodecs" }).click();
    await panel.locator("[data-video-transform-capability]").getByText(/codifica e decodifica WebCodecs verificate/iu).waitFor({ timeout: 25_000 });
    checks += 3;
    for (const mode of (index === 0 ? ["target-size", "bitrate"] : ["target-size"])) {
      await panel.getByLabel("Strategia di compressione").selectOption(mode);
      if (mode === "target-size") await panel.getByRole("spinbutton", { name: /Dimensione obiettivo/u }).fill("0.08");
      else await panel.getByRole("spinbutton", { name: /Bitrate video obiettivo/u }).fill("350");
      await panel.getByRole("button", { name: "Genera MP4 H.264 + AAC" }).click();
      await Promise.race([
        panel.locator("[data-video-transform-result]").waitFor({ timeout: 45_000 }),
        panel.locator("[data-video-transform-status]").getByText(/VIDEO_234_|VIDEO_38_/u).waitFor({ timeout: 45_000 })
          .then(async () => { throw Error(await panel.locator("[data-video-transform-status]").innerText()); }),
      ]);
      const facts = await panel.locator("[data-video-compression-38]").innerText();
      const plan = await panel.locator("[data-video-compression-strategy-result]").innerText();
      assert(facts.includes(originalSize + " → "));
      assert(facts.includes(fixture.label));
      assert(facts.includes(fixture.audioLabel));
      assert.match(facts, /H\.264 64×48/u);
      if (mode === "target-size") assert.match(plan, /Dimensione obiettivo 80000 byte: raggiunta/u);
      else assert.match(plan, /bitrate video richiesto/u);
      checks += 5;
      const [download] = await Promise.all([
        page.waitForEvent("download"), panel.getByRole("link", { name: "Scarica MP4 ricodificato" }).click(),
      ]);
      assert.equal(download.suggestedFilename(), "video-ricodificato.mp4");
      const path = await download.path();
      assert(path);
      const size = (await readFile(path)).length;
      const output = probe(path);
      const video = output.streams.find(s => s.codec_type === "video");
      const audio = output.streams.find(s => s.codec_type === "audio");
      assert.equal(output.streams.length, 2);
      assert.equal(video.codec_name, "h264");
      assert.equal(audio.codec_name, "aac");
      assert.deepEqual([video.width, video.height], [64, 48]);
      assert(Math.abs(Number(output.format.duration) - 1.5) <= 0.18);
      assert(Math.abs(Number(audio.start_time) - Number(video.start_time)) <= 0.12);
      assert(Math.abs(Number(audio.duration) - Number(video.duration)) <= 0.18);
      assert(facts.includes("→ " + size + " byte"), "Rendered receipt must match actual downloaded bytes");
      if (mode === "target-size") assert(size <= 80_000);
      checks += 11;
      console.log("#38", fixture.path, mode, originalSize + "->" + size, "H264/AAC", output.format.duration, "s");
    }
  }
  // Fail closed for a target too small for the audio budget.
  await panel.getByLabel("Strategia di compressione").selectOption("target-size");
  await panel.getByRole("spinbutton", { name: /Dimensione obiettivo/u }).fill("0.01");
  await panel.getByRole("button", { name: "Genera MP4 H.264 + AAC" }).click();
  await panel.locator("[data-video-transform-status]").getByText(/VIDEO_38_TARGET_SIZE/u).waitFor({ timeout: 15_000 });
  assert.equal(await panel.locator("[data-video-transform-result]").count(), 0);
  checks += 2;
  const workers = await page.evaluate(() => window.__video38Workers);
  assert.equal(workers.created, workers.terminated, JSON.stringify(workers));
  assert.deepEqual(offsite, []);
  assert.deepEqual(errors, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  checks += 4;
  console.log("VIDEO_TRANSFORM_FAMILY_38_BROWSER_PASS checks=" + checks + " workers=" + JSON.stringify(workers));
} finally { await browser?.close(); }
