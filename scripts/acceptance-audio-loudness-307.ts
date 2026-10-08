/** Desktop Chromium, built static output, offline fixture. NOT physical-device or broadcast Gold. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const port = 18496;
const origin = `http://127.0.0.1:${port}`;

function sineWav(): Buffer {
  const rate = 48_000;
  const frames = rate * 4;
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i += 1) {
    const value = Math.round(0.1 * Math.sin(2 * Math.PI * 997 * i / rate) * 32767);
    data.writeInt16LE(value, i * 2);
  }
  const wav = Buffer.alloc(44 + data.length);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(data.length, 40);
  data.copy(wav, 44);
  return wav;
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let started = false;
  for (let tries = 0; tries < 100; tries += 1) {
    try { const response = await fetch(`${origin}/tools/audio-generator/`); started = response.ok; if (started) break; } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!started) throw new Error("Audio generator built route not accessible");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const violations: string[] = [];
  page.on("pageerror", (error) => violations.push(`JS: ${error.message}`));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) violations.push(`Offsite: ${request.url()}`);
    if (request.method() !== "GET") violations.push(`Non-GET: ${request.method()}`);
  });
  await page.goto(`${origin}/tools/audio-generator/`, { waitUntil: "networkidle" });
  const section = page.locator("[data-audio-loudness-307]");
  await section.waitFor();
  const input = section.locator('input[type="file"]');
  const fixture = sineWav();
  await input.setInputFiles({ name: "997hz-20dbfs.wav", mimeType: "audio/wav", buffer: fixture });
  if (await section.locator("[data-loudness-results]").count() !== 0) throw new Error("Unexpected eager analysis");
  await section.getByRole("button", { name: "Analizza localmente" }).click();
  await section.locator("[data-loudness-results]").waitFor({ timeout: 15_000 });
  const resultText = await section.locator("[data-loudness-results]").innerText();
  const match = resultText.match(/(-?\d+(?:\.\d+)?) LUFS/u);
  if (match === null) throw new Error(`Integrated LUFS missing: ${resultText}`);
  const lufs = Number(match[1]);
  if (Math.abs(lufs - (-23.01)) > 0.25) throw new Error(`Expected ~-23.01 LUFS, measured ${lufs}`);
  if (!resultText.includes("non true peak") && !resultText.includes("non true peak".toUpperCase())) throw new Error("Sample peak disclaimer missing");
  if (!resultText.includes("48000 Hz")) throw new Error("Sample rate not disclosed");
  if (!await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)) throw new Error("Mobile viewport overflow");
  if (violations.length !== 0) throw new Error(violations.join(" | "));
  console.log(JSON.stringify({ status: "PASS", tool: "audio-loudness-307", actualLufs: lufs, expectedLufs: -23.01,
    sampleRate: 48000, channels: 1, durationSeconds: 4, browser: "desktop-Chromium", viewport: [390, 844],
    outputControls: "local-only", offsiteRequests: 0, physicalDevice: false }));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
