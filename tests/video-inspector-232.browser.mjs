// Run after npm run build: node tests/video-inspector-232.browser.mjs
// Browser acceptance on the actual static route, real MP4 fixture and bundle.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_VIDEO_PORT ?? 18432);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser;
let checks = 0;

async function assertServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(origin)).ok) return; } catch { /* server starting */ }
    await new Promise((done) => setTimeout(done, 125));
  }
  throw new Error("No static server available for video inspector acceptance");
}

try {
  await assertServer();
  // The route imports the MP4 metadata parser directly. Confirm its own chunk's
  // source map has no transcoder/ffmpeg/wasm implementation, not just an absent
  // UI action that could import heavy libraries behind the scenes.
  const assetDir = resolve(root, "dist/_astro");
  const assets = await readdir(assetDir);
  const mapNames = assets.filter((name) => /^VideoInspectorTool\..*\.js\.map$/u.test(name));
  assert(mapNames.length > 0, "VideoInspectorTool sourcemap must be present for negative bundle proof");
  for (const name of mapNames) {
    const map = JSON.parse(await readFile(resolve(assetDir, name), "utf8"));
    const origins = map.sources.filter((source) => /(?:ffmpeg|transcod|\.wasm(?:$|\?))/iu.test(source));
    assert.deepEqual(origins, [], `Heavy media dependency bundled in inspector: ${name}`);
    checks += 1;
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    const slice = Blob.prototype.slice;
    window.__videoSliceAudit = { maxBytes: 0, totalBytes: 0, calls: 0 };
    Blob.prototype.slice = function (start, end, contentType) {
      if (this instanceof File && /\.mp4$/iu.test(this.name)) {
        const bytes = Math.max(0, Math.min(end ?? this.size, this.size) - Math.max(start ?? 0, 0));
        window.__videoSliceAudit.maxBytes = Math.max(window.__videoSliceAudit.maxBytes, bytes);
        window.__videoSliceAudit.totalBytes += bytes;
        window.__videoSliceAudit.calls++;
      }
      return slice.call(this, start, end, contentType);
    };
  });
  const external = [];
  const suspiciousMediaChunks = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("data:") && !request.url().startsWith("blob:")) external.push(request.url());
    if (/(?:ffmpeg|transcoder|ffprobe)/iu.test(request.url())) suspiciousMediaChunks.push(request.url());
  });
  const response = await page.goto(`${origin}/tools/video-inspector/`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, "Inspector static route exists");
  await page.getByRole("heading", { level: 1, name: "Ispeziona MP4 e calcola il bitrate", exact: true }).waitFor();
  assert.equal(await page.locator('form[aria-label="Analisi metadati MP4"] input[type=file]').count(), 1);
  checks += 2;

  await page.locator('form[aria-label="Analisi metadati MP4"] input[type=file]').setInputFiles(resolve(root, "quality/fixtures/video-inspection/video-plus-audio.mp4"));
  await page.getByRole("button", { name: "Analizza metadati" }).click();
  await page.locator("[data-video-inspection]").waitFor();
  const inspected = await page.locator("[data-video-inspection]").innerText();
  assert.match(inspected, /avc1/u);
  assert.match(inspected, /mp4a/u);
  assert.match(inspected, /80 × 60/u);
  assert.match(inspected, /10 fps \(PTS verificati, CFR\) \/ cfr/u);
  assert.match(inspected, /mp4a[\s\S]*?Sconosciuto \/ Sconosciuto/u);
  assert.equal(await page.locator("[data-video-duration]").inputValue(), "1.2");
  checks += 5;

  await page.locator("[data-video-duration]").fill("100");
  await page.locator("[data-video-target]").fill("100");
  await page.getByRole("button", { name: "Calcola bitrate teorico" }).click();
  await page.locator("[data-video-plan]").waitFor();
  assert.match(await page.locator("[data-video-budget]").innerText(), /8\.?000 kbit\/s/u);
  assert.match(await page.locator("[data-video-plan]").innerText(), /Sconosciuto/u);
  checks += 2;

  await page.locator('form[aria-label="Analisi metadati MP4"] input[type=file]').setInputFiles(resolve(root, "quality/fixtures/video-inspection/video-vfr.mp4"));
  await page.getByRole("button", { name: "Analizza metadati" }).click();
  await page.locator("[data-video-inspection]").waitFor();
  const variable = await page.locator("[data-video-inspection]").innerText();
  assert.match(variable, /Delta di decodifica variabili \(stts\); VFR non provato/u);
  assert.match(variable, /Intervalli PTS variabili \(VFR\); FPS medio non misurato \/ vfr/u);
  assert(Math.abs(Number(await page.locator("[data-video-duration]").inputValue()) - 2.916667) < 0.001);
  checks += 3;

  await page.locator('form[aria-label="Analisi metadati MP4"] input[type=file]').setInputFiles(resolve(root, "quality/fixtures/video-inspection/video-multistream.mp4"));
  await page.getByRole("button", { name: "Analizza metadati" }).click();
  await page.locator("[data-video-inspection]").waitFor();
  const multiple = await page.locator("[data-video-inspection]").innerText();
  assert.match(multiple, /2 video, 1 audio/u);
  assert.match(multiple, /64 × 48/u);
  assert.match(multiple, /80 × 60/u);
  assert.equal(await page.locator("[data-video-inspection] tbody tr").count(), 3);
  checks += 4;

  await page.locator('form[aria-label="Analisi metadati MP4"] input[type=file]').setInputFiles(resolve(root, "quality/fixtures/video-inspection/video-hour-sparse.mp4"));
  await page.getByRole("button", { name: "Analizza metadati" }).click();
  await page.locator("[data-video-inspection]").waitFor();
  assert.equal(await page.locator("[data-video-duration]").inputValue(), "3600");
  assert.match(await page.locator("[data-video-inspection]").innerText(), /Delta di decodifica costanti \(stts\); CFR non provato/u);
  checks += 2;

  // Additional real ISO BMFF bytes, generated independently with FFmpeg and
  // re-probed by ffprobe in video-hevc-fragment-232.test.ts. No audio/video
  // decode is claimed by this read-only inspector.
  await page.locator('form[aria-label="Analisi metadati MP4"] input[type=file]').setInputFiles(resolve(root, "quality/fixtures/video-inspection/extension/video-hevc-hvc1.mp4"));
  await page.getByRole("button", { name: "Analizza metadati" }).click();
  await page.locator("[data-video-inspection]").waitFor();
  const hevc = await page.locator("[data-video-inspection]").innerText();
  assert.match(hevc, /hvc1/u);
  assert.match(hevc, /64 × 48/u);
  assert.match(hevc, /Sconosciuto \/ Sconosciuto/u);
  assert.equal(await page.locator("[data-video-duration]").inputValue(), "1");
  checks += 4;

  await page.locator('form[aria-label="Analisi metadati MP4"] input[type=file]').setInputFiles(resolve(root, "quality/fixtures/video-inspection/extension/video-fragmented.mp4"));
  await page.getByRole("button", { name: "Analizza metadati" }).click();
  await page.locator("[data-video-inspection]").waitFor();
  const fragmented = await page.locator("[data-video-inspection]").innerText();
  assert.match(fragmented, /MP4 frammentato[\s\S]*?Sì/u);
  assert.match(fragmented, /durata totale non certificata/u);
  assert.equal(await page.locator("[data-video-duration]").inputValue(), "");
  assert.match(fragmented, /Sconosciuto \/ Sconosciuto/u);
  checks += 4;

  const bounded = await page.evaluate(() => window.__videoSliceAudit);
  assert(bounded.calls >= 4, "Actual File.slice must be invoked on MP4 samples");
  assert(bounded.maxBytes <= 8 * 1024 * 1024, "MP4 metadata reads stay capped at 8 MiB");
  assert(bounded.totalBytes < 1024 * 1024, "Aggregate browser metadata reads do not scale with one-hour duration");
  checks += 3;

  // Selecting a new invalid file must clear stale verified results, and fail closed.
  await page.locator('form[aria-label="Analisi metadati MP4"] input[type=file]').setInputFiles({
    name: "not-a-video.mp4", mimeType: "video/mp4", buffer: Buffer.from("%PDF-1.7\n"),
  });
  assert.equal(await page.locator("[data-video-inspection]").count(), 0);
  assert.equal(await page.locator("[data-video-plan]").count(), 0);
  await page.getByRole("button", { name: "Analizza metadati" }).click();
  await page.locator(".video-tool-alert").waitFor();
  assert.match(await page.locator(".video-tool-alert").innerText(), /non è un MP4/u);
  checks += 4;

  assert.deepEqual(external, [], "No offsite browser requests");
  assert.deepEqual(suspiciousMediaChunks, [], "No transcoder or FFmpeg browser requests");
  checks += 2;
  console.log(`Video inspector browser acceptance: PASS (${checks} checks)`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
