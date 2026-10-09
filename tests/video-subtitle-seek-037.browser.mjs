// Standalone Chromium media acceptance: uses real authored MP4 byte streams.
// Does not claim a hardware mobile device, codec portability, or frame-perfect
// equivalence to a requested seek position. The production UI has separate gates.
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { transform } from "esbuild";

const root = resolve(import.meta.dirname, "../quality/fixtures/video-inspection");
const experiments = [
  {
    file: "037-pts-cfr-colors.mp4", duration: 3,
    packetPts: Array.from({ length: 12 }, (_, index) => index / 4),
    seeks: [
      { requested: 0.5, color: "red" },
      { requested: 1.5, color: "green" },
      { requested: 2.5, color: "blue" },
    ],
  },
  {
    file: "037-pts-vfr-colors.mp4", duration: 1.44,
    packetPts: [0, 0.4, 1.12, 1.4],
    seeks: [
      { requested: 0.15, color: "red" },
      { requested: 0.55, color: "green" },
      { requested: 1.2, color: "blue" },
    ],
  },
];

const browser = await chromium.launch({ headless: true });
let checks = 0;
const observations = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const offsite = [];
  const pageErrors = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setContent(`<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body><input id="file" type="file" accept="video/mp4"><input id="subtitle" type="file" accept=".srt"><video id="movie" playsinline muted preload="auto" width="320" height="240"></video></body></html>`);

  for (const experiment of experiments) {
    await page.locator("#file").setInputFiles(resolve(root, experiment.file));
    const info = await page.evaluate(async () => {
      const video = document.querySelector("#movie");
      if (window.__fixtureUrl) URL.revokeObjectURL(window.__fixtureUrl);
      window.__fixtureUrl = URL.createObjectURL(document.querySelector("#file").files[0]);
      video.src = window.__fixtureUrl;
      await new Promise((resolveReady, rejectReady) => {
        video.addEventListener("loadedmetadata", resolveReady, { once: true });
        video.addEventListener("error", () => rejectReady(Error("MP4 could not decode metadata")), { once: true });
      });
      return { duration: video.duration, width: video.videoWidth, height: video.videoHeight,
        frameCallback: typeof video.requestVideoFrameCallback === "function" };
    });
    assert.equal(info.frameCallback, true, "Chromium must provide presented-frame timestamp callbacks");
    assert.deepEqual([info.width, info.height], [64, 48]);
    assert(Math.abs(info.duration - experiment.duration) < 0.02, `Unexpected media duration for ${experiment.file}: ${info.duration}`);
    checks += 4;

    for (const seek of experiment.seeks) {
      const decoded = await page.evaluate(async (requested) => {
        const movie = document.querySelector("#movie");
        const seeked = new Promise((ok, fail) => {
          movie.addEventListener("seeked", ok, { once: true });
          movie.addEventListener("error", () => fail(Error("Media seek decoding error")), { once: true });
        });
        movie.currentTime = requested;
        await seeked;
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const currentTime = movie.currentTime;
        const canvas = document.createElement("canvas");
        canvas.width = movie.videoWidth;
        canvas.height = movie.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(movie, 0, 0);
        const pixel = [...ctx.getImageData(32, 24, 1, 1).data].slice(0, 3);
        // Chromium headless does not always emit rVFC for paused seeks. Ask for
        // the next presented frame while muted playback runs, then pause. This
        // may be a *later* frame, so never compare it with the requested seek.
        const presented = new Promise((ok) => movie.requestVideoFrameCallback((_, metadata) => ok(metadata.mediaTime)));
        await movie.play();
        const mediaTime = await Promise.race([
          presented,
          new Promise((_, fail) => setTimeout(() => fail(Error("No presented-frame callback after seek")), 3_000)),
        ]);
        movie.pause();
        return { requested, currentTime, mediaTime, pixel };
      }, seek.requested);
      assert(Math.abs(decoded.currentTime - seek.requested) < 0.03, `Seeked currentTime mismatch: ${JSON.stringify(decoded)}`);
      // Callback can arrive during subsequent playback and reference a later
      // frame: only assert the PTS belongs to the independent FFprobe corpus.
      assert(experiment.packetPts.some((pts) => Math.abs(decoded.mediaTime - pts) < 0.045),
        `Reported presentation PTS is not in the source packets: ${JSON.stringify(decoded)}`);
      const [r, g, b] = decoded.pixel;
      if (seek.color === "red") assert(r > 155 && g < 65 && b < 65, `Expected red: ${decoded.pixel}`);
      if (seek.color === "green") assert(g > 75 && r < 65 && b < 65, `Expected green: ${decoded.pixel}`);
      if (seek.color === "blue") assert(b > 155 && r < 65 && g < 65, `Expected blue: ${decoded.pixel}`);
      observations.push({ file: experiment.file, ...decoded, color: seek.color });
      checks += 3;
    }
  }

  // Exercise the actual production subtitle parser as browser JavaScript on a
  // real user File. No mock parser, server request, static-site build or CDNs.
  const source = await readFile(resolve(import.meta.dirname, "../src/engines/text-writing/subtitles.ts"), "utf8");
  const bundle = await transform(source, { loader: "ts", format: "iife", globalName: "SubtitleEngine037", target: "es2022" });
  await page.addScriptTag({ content: bundle.code });
  await page.locator("#subtitle").setInputFiles(resolve(import.meta.dirname, "../quality/fixtures/subtitle-transform/037-vfr-color-cues.srt"));
  const subtitles = await page.evaluate(async () => {
    const file = document.querySelector("#subtitle").files[0];
    const output = window.SubtitleEngine037.processSubtitles({ text: await file.text(), sourceFormat: "auto", output: "vtt", readingSpeedCps: 17 });
    const reopened = window.SubtitleEngine037.processSubtitles({ text: output.output, sourceFormat: "vtt", output: "srt" });
    return {
      fileSize: file.size, cues: output.cueCount, starts: output.cues.map((cue) => cue.startMs),
      endTimes: output.cues.map((cue) => cue.endMs), overlaps: output.overlapCount,
      cpsIssues: output.readingSpeedIssueCount, transcript: output.transcript,
      roundtrip: reopened.cues.map((cue) => [cue.startMs, cue.endMs, ...cue.textLines]),
    };
  });
  assert(subtitles.fileSize > 0);
  assert.equal(subtitles.cues, 4);
  assert.deepEqual(subtitles.starts, [0, 400, 1100, 1400]);
  assert.deepEqual(subtitles.endTimes, [400, 1120, 1400, 1440]);
  assert.equal(subtitles.overlaps, 1);
  assert.equal(subtitles.cpsIssues, 1);
  assert.equal(subtitles.transcript, "ROSSO\nVERDE — é\nBLU\nFine\n");
  assert.deepEqual(subtitles.roundtrip, [
    [0, 400, "ROSSO"], [400, 1120, "VERDE — é"], [1100, 1400, "BLU"], [1400, 1440, "Fine"],
  ]);
  checks += 8;

  const revoked = await page.evaluate(() => {
    URL.revokeObjectURL(window.__fixtureUrl);
    document.querySelector("#movie").removeAttribute("src");
    document.querySelector("#movie").load();
    return true;
  });
  assert(revoked);
  assert.deepEqual(offsite, [], "Local media decode must not use HTTP requests");
  assert.deepEqual(pageErrors, [], "No JavaScript errors during real seeks");
  checks += 3;
  console.log(`PASS #037 browser fixture seeking (${checks} checks, Chromium 390×844).`);
  console.log(JSON.stringify(observations, null, 2));
} finally {
  await browser.close();
}
