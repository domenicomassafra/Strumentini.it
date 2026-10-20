// Run after npm run build. Tests the real browser Worker and compiled static route.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";

const root = resolve(import.meta.dirname, "..");
const port = 18497;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser;

async function loaded() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error("Static site did not start");
}

try {
  await loaded();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const unexpectedRequests = [];
  const pageErrors = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) unexpectedRequests.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(`${origin}/tools/video-inspector/`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  const input = page.locator('form[aria-label="Analizza tag audio"] input[type=file]');
  await input.waitFor();

  for (const [filename, expected] of [
    ["id3v1.mp3", "Titolo v1"],
    ["id3v2-unicode.mp3", "Città è café 🎵"],
    ["vorbis-flac.flac", "Brano FLAC"],
    ["vorbis.ogg", "Brano Ogg"],
    ["pcm.wav", "Brano WAV"],
  ]) {
    await input.setInputFiles(resolve(root, "tests/fixtures/audio-metadata-297", filename));
    await page.getByRole("button", { name: "Leggi tag audio" }).click();
    await page.locator("[data-audio-metadata-result]").waitFor({ timeout: 10_000 });
    assert.match(await page.locator("[data-audio-metadata-result]").innerText(), new RegExp(expected));
    assert.match(await page.locator("[data-audio-metadata-result]").innerText(), /44\.100|48\.000/u);
  }

  await input.setInputFiles({ name: "forged.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(512) });
  await page.getByRole("button", { name: "Leggi tag audio" }).click();
  await page.locator('[data-audio-metadata-297] [role="alert"]').waitFor();
  assert.equal(await page.locator("[data-audio-metadata-result]").count(), 0);
  assert.match(await page.locator('[data-audio-metadata-297] [role="alert"]').innerText(), /Formato non riconosciuto/u);
  assert.deepEqual(unexpectedRequests, [], "The audio inspector must never contact a remote host");
  assert.deepEqual(pageErrors, [], "Browser must not throw uncaught errors");
  console.log("Audio metadata browser acceptance: PASS (5 genuine containers, 1 fake rejection, no external requests)");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
