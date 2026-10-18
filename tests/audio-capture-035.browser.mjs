import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { chromium } from "playwright";

/** Real Chromium MediaRecorder + Web Audio exercise with a synthetic microphone. */
const base = process.env.AUDIO035_TEST_BASE_URL ?? "http://127.0.0.1:4390";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== base) externalRequests.push(request.url());
  });
  await page.goto(`${base}/tools/microphone-recorder/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => [...document.querySelectorAll("astro-island")].some((el) =>
    el.getAttribute("component-url")?.includes("MicrophoneRecorderTool") && !el.hasAttribute("ssr")), null, { timeout: 60_000 });

  const recorder = page.locator("[data-microphone-recorder]");
  await recorder.getByRole("button", { name: "Attiva microfono", exact: true }).click();
  await recorder.getByRole("region", { name: "Stato microfono" }).waitFor({ timeout: 20_000 });
  await recorder.locator('progress[aria-label="Livello microfono"]').waitFor();
  await page.waitForFunction(() => (document.querySelector('[data-microphone-recorder] progress')?.value ?? 0) > 0.005, null, { timeout: 8000 });
  const level = await recorder.locator("progress").evaluate((element) => Number(element.value));
  assert(Number.isFinite(level) && level > 0 && level <= 1);
  await recorder.getByRole("button", { name: "Registra", exact: true }).click();
  await recorder.getByRole("button", { name: "Pausa", exact: true }).waitFor({ state: "visible" });
  await page.waitForTimeout(1300); // Gather real encoded MediaRecorder frames from the synthetic device.
  await recorder.getByRole("button", { name: "Pausa", exact: true }).click();
  await recorder.getByText("Registrazione in pausa.").waitFor();
  await recorder.getByRole("button", { name: "Riprendi" }).click();
  await page.waitForTimeout(1200);
  await recorder.getByRole("button", { name: "Ferma registrazione" }).click();
  await recorder.getByRole("region", { name: "Registrazione locale" }).waitFor({ timeout: 15_000 });

  await recorder.locator("audio").evaluate(async (element) => { await element.play(); });
  await page.waitForFunction(() => {
    const audio = document.querySelector('[data-microphone-recorder] audio');
    return audio && !audio.paused && audio.currentTime > 0.08;
  }, null, { timeout: 10000 });
  const playable = await recorder.locator("audio").evaluate((element) => {
    const result = { played: !element.paused && element.currentTime > 0, currentTime: element.currentTime, duration: element.duration };
    element.pause();
    return result;
  });
  assert(playable.played, `MediaRecorder output not playable: ${JSON.stringify(playable)}`);
  assert(playable.duration > 0);

  const downloading = page.waitForEvent("download");
  await recorder.getByRole("link", { name: "Scarica registrazione" }).click();
  const download = await downloading;
  assert.match(download.suggestedFilename(), /^registrazione-audio\.(webm|ogg|mp4|wav)$/u);
  const bytes = await readFile(await download.path());
  assert(bytes.byteLength > 1000, `Unexpected recording size: ${bytes.byteLength}`);
  assert.equal((await stat(await download.path())).size, bytes.byteLength);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  console.log(`STR-035 REAL_BROWSER_PASS: microphone RMS=${level.toFixed(3)}, recording pause/resume, playback advanced ${playable.currentTime.toFixed(2)}s, downloaded ${bytes.length} bytes ${download.suggestedFilename()}, no remote requests or JS errors`);
} finally {
  await browser.close();
}
