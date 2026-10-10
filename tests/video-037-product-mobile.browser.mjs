// #037 integrated product acceptance. Playwright mobile-size emulation is not
// a physical iOS/Android device or a codec-compatibility certification.
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const port = 18437;
const origin = (process.env.VIDEO037_ORIGIN ?? `http://127.0.0.1:${port}`).replace(/\/$/u, "");
const server = process.env.VIDEO037_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" });
const engines = { chromium, firefox, webkit };
const requested = (process.env.VIDEO037_BROWSERS ?? "chromium,firefox,webkit").split(",").map(name => name.trim());
const videoFixtures = "quality/fixtures/video-inspection";
const srtFixture = "quality/fixtures/subtitle-transform/037-vfr-color-cues.srt";
let checks = 0;

async function waitForSite() {
  for (let i = 0; i < 120; i++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw Error(`Astro dev exited ${server.exitCode}`);
    try { if ((await fetch(`${origin}/tools/video-inspector/`)).ok) return; } catch { /* start-up */ }
    await new Promise(done => setTimeout(done, 100));
  }
  throw Error(`Product route failed to start: ${origin}`);
}

async function downloadedPixel(download) {
  const path = await download.path();
  assert(path, "Browser must save the actual downloaded PNG");
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [64, 48]);
  const index = (24 * 64 + 32) * info.channels;
  checks += 2;
  return [...data.subarray(index, index + 3)];
}

try {
  await waitForSite();
  for (const name of requested) {
    assert(name in engines, `Unknown browser ${name}`);
    const browser = await engines[name].launch({ headless: true });
    try {
      for (const width of [320, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true, hasTouch: true });
        try {
          const page = await context.newPage();
          const requests = [];
          const errors = [];
          page.on("request", request => {
            if ((!request.url().startsWith(origin) && !/^(blob:|data:)/u.test(request.url())) || request.method() !== "GET") {
              requests.push(`${request.method()} ${request.url()}`);
            }
          });
          page.on("pageerror", error => errors.push(error.message));
          assert.equal((await page.goto(`${origin}/tools/video-inspector/`, { waitUntil: "networkidle" })).status(), 200);
          await page.locator("[data-video-frame-camera-305]").waitFor();
          assert.match(await page.locator("[data-video-inspector-route]").innerText(), /CFR\/VFR/u);
          checks += 2;

          const inspectInput = page.locator('form[aria-label="Analisi metadati MP4"] input[type="file"]');
          await inspectInput.setInputFiles(resolve(root, videoFixtures, "037-pts-cfr-colors.mp4"));
          await page.getByRole("button", { name: "Analizza metadati" }).click();
          await page.locator("[data-video-inspection]").waitFor();
          assert.match(await page.locator("[data-video-inspection]").innerText(), /4 fps.*cfr/iu);
          await inspectInput.setInputFiles(resolve(root, videoFixtures, "037-pts-vfr-colors.mp4"));
          await page.getByRole("button", { name: "Analizza metadati" }).click();
          await page.locator("[data-video-inspection]").getByText(/vfr/i).first().waitFor();
          assert.match(await page.locator("[data-video-inspection]").innerText(), /VFR/iu);
          checks += 2;

          const framePanel = page.locator("[data-video-frame-camera-305]");
          await framePanel.locator('input[type="file"]').setInputFiles(resolve(root, videoFixtures, "037-pts-cfr-colors.mp4"));
          await framePanel.getByText(/durata dichiarata/iu).waitFor();
          await framePanel.getByRole("spinbutton", { name: "Timestamp richiesto, secondi" }).fill("0.5");
          await framePanel.getByRole("button", { name: "Estrai fotogramma PNG" }).click();
          await framePanel.locator("[data-frame-result]").waitFor({ timeout: 20_000 });
          const [download] = await Promise.all([
            page.waitForEvent("download"), framePanel.getByRole("link", { name: "Scarica fotogramma PNG" }).click(),
          ]);
          assert.equal(download.suggestedFilename(), "fotogramma-locale.png");
          const [r, g, b] = await downloadedPixel(download);
          assert(r > 150 && g < 80 && b < 80, `${name} ${width}px decoded color ${r},${g},${b}`);
          assert.match(await framePanel.locator("[data-frame-result]").innerText(), /Richiesto: 0\.500 s/u);
          checks += 3;

          await framePanel.locator('input[type="file"]').setInputFiles(resolve(root, videoFixtures, "037-pts-vfr-colors.mp4"));
          await framePanel.getByText(/Sorgente: 037-pts-vfr-colors\.mp4/u).waitFor();
          await framePanel.getByRole("spinbutton", { name: "Timestamp richiesto, secondi" }).fill("1.2");
          await framePanel.getByRole("button", { name: "Estrai fotogramma PNG" }).click();
          await framePanel.locator("[data-frame-result]").waitFor({ timeout: 20_000 });
          const [vfrDownload] = await Promise.all([
            page.waitForEvent("download"), framePanel.getByRole("link", { name: "Scarica fotogramma PNG" }).click(),
          ]);
          const [vr, vg, vb] = await downloadedPixel(vfrDownload);
          assert(vb > 150 && vr < 80 && vg < 80, `${name} ${width}px VFR decoded color ${vr},${vg},${vb}`);
          checks++;

          await framePanel.getByRole("spinbutton", { name: "Timestamp richiesto, secondi" }).fill("3.01");
          await framePanel.getByRole("button", { name: "Estrai fotogramma PNG" }).click();
          await framePanel.locator("[data-frame-status]").getByText(/VIDEO_FRAME_RANGE/u).waitFor();
          assert.equal(await framePanel.locator("[data-frame-result]").count(), 0, "Stale PNG after invalid timestamp");
          checks++;

          assert.equal((await page.goto(`${origin}/tools/subtitle-srt-vtt-transform/`, { waitUntil: "networkidle" })).status(), 200);
          await page.getByLabel("Sottotitoli SRT o WebVTT").fill(await readFile(resolve(root, srtFixture), "utf8"));
          await page.getByRole("button", { name: "Elabora sottotitoli", exact: true }).click();
          await page.locator('[data-result-slot="selectable-output"]').waitFor();
          assert.match(await page.locator('[data-result-slot="selectable-output"]').innerText(), /WEBVTT/u);
          assert.match(await page.locator('[aria-label="Diagnostica sottotitoli"]').innerText(), /OVERLAP|overlap/u);
          const [vttDownload] = await Promise.all([
            page.waitForEvent("download"), page.locator('button[data-result-action="download"]').click(),
          ]);
          assert.equal(vttDownload.suggestedFilename(), "sottotitoli.vtt");
          const vtt = await readFile(await vttDownload.path(), "utf8");
          assert.match(vtt, /00:00:01\.100 --> 00:00:01\.400/u);
          assert.match(vtt, /VERDE — é/u);
          const [transcriptDownload] = await Promise.all([
            page.waitForEvent("download"), page.getByRole("button", { name: "Scarica trascrizione completa" }).click(),
          ]);
          assert.equal(transcriptDownload.suggestedFilename(), "trascrizione-sottotitoli.txt");
          assert.equal(await readFile(await transcriptDownload.path(), "utf8"), "ROSSO\nVERDE — é\nBLU\nFine\n");
          checks += 6;

          const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
          assert.equal(horizontalOverflow, false, `${name} ${width}px subtitle route horizontal overflow`);
          assert.deepEqual(requests, [], `${name} ${width}px emitted offsite or write requests`);
          assert.deepEqual(errors, [], `${name} ${width}px emitted JavaScript page errors`);
          checks += 3;
          if (name === "chromium" && width === 390) await page.screenshot({ path: join(tmpdir(), "strumentini-037-mobile390.png"), fullPage: true });
          console.log(`#037 ${name} ${width}px: PASS; MP4 CFR/VFR, downloaded real PNG and SRT→VTT/transcript; zero offsite`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  console.log(`VIDEO037_PRODUCT_MOBILE_PASS checks=${checks} engines=${requested.join(",")} viewports=320,390`);
} finally { server?.kill("SIGTERM"); }
