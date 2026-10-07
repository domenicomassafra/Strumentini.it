import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18199;
const suppliedOrigin = process.env.BROWSER_AUDIO_ACCEPTANCE_ORIGIN?.replace(/\/$/u, "");
const origin = suppliedOrigin ?? `http://127.0.0.1:${port}`;
const server = suppliedOrigin === undefined
  ? spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" })
  : null;
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`browser audio acceptance server unavailable at ${origin}`);
}

function requestAudit(page) {
  const requests = [];
  const errors = [];
  let started = false;
  page.on("request", (request) => { if (started) requests.push({ url: request.url(), method: request.method(), postData: request.postData() }); });
  page.on("pageerror", (error) => errors.push({ text: String(error), url: "" }));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push({ text: message.text(), url: message.location()?.url ?? "" });
  });
  return {
    start() { started = true; },
    assert(id) {
      const bad = requests.filter((request) => {
        const local = request.url.startsWith(origin) || request.url.startsWith("blob:") || request.url.startsWith("data:");
        return !local || request.method !== "GET" || (request.postData ?? "") !== "";
      });
      if (bad.length > 0) throw new Error(`${id}: external/non-GET/task-body request ${JSON.stringify(bad)}`);
      const unexpectedErrors = errors.filter((entry) => {
        try { return new URL(entry.url).pathname !== "/api/auth/session"; } catch { return true; }
      });
      if (unexpectedErrors.length > 0) throw new Error(`${id}: runtime errors ${unexpectedErrors.map(({ text, url }) => `${text} (${url})`).join(" | ")}`);
      return { externalTaskRequests: 0, nonGetTaskRequests: 0, taskContentLeaks: 0, runtimeErrors: 0 };
    },
  };
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const results = [];
    try {
      {
        const page = await context.newPage();
        const audit = requestAudit(page);
        const response = await page.goto(`${origin}/tools/audio-generator/`, { waitUntil: "networkidle" });
        if (response?.status() !== 200) throw new Error("audio-generator route unavailable");
        await page.locator("[data-audio-generator]").waitFor();
        audit.start();
        await page.getByRole("button", { name: "Avvia", exact: true }).click();
        await page.getByText(/Tono 440 Hz attivo/u).waitFor();
        await page.getByRole("button", { name: "Ferma", exact: true }).click();
        await page.getByText("Audio fermato.", { exact: true }).waitFor();
        await page.getByLabel("Modalità").selectOption("metronome");
        await page.getByRole("button", { name: "Tap tempo", exact: true }).click();
        await page.getByText(/Tocca ancora/u).waitFor();
        const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        if (horizontalOverflow) throw new Error("audio-generator horizontal overflow at 390px");
        results.push({ toolId: "audio-generator", status: "PASS", ...audit.assert("audio-generator"), horizontalOverflow: false, scope: "bounded controls, start/stop, tap-tempo surface; browser scheduling precision remains platform controlled" });
        await page.close();
      }
      {
        const ttsContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ttsContext.newPage();
        const audit = requestAudit(page);
        const response = await page.goto(`${origin}/tools/browser-text-to-speech/`, { waitUntil: "networkidle" });
        if (response?.status() !== 200) throw new Error("browser-text-to-speech route unavailable");
        await page.locator("[data-browser-tts]").waitFor();
        const capability = await page.evaluate(() => ({ speechSynthesis: "speechSynthesis" in window, utterance: typeof SpeechSynthesisUtterance === "function" }));
        if (!capability.speechSynthesis || !capability.utterance) throw new Error(`headless Chromium unexpectedly lacks SpeechSynthesis: ${JSON.stringify(capability)}`);
        audit.start();
        const textarea = page.getByLabel(/Testo · max 20\.000 caratteri/u);
        await textarea.fill("Ciao certificazione");
        await page.getByLabel(/Velocità/u).fill("1.2");
        await page.getByLabel(/Tono ·/u).fill("0.8");
        const speakButton = page.getByRole("button", { name: "Leggi", exact: true });
        if (await speakButton.isDisabled()) throw new Error("SpeechSynthesis is present but the public speak control is disabled");
        await speakButton.click();
        await page.getByText(/Lettura avviata|Lettura conclusa|non ha completato la lettura/u).waitFor();
        if (!/SpeechSynthesis del browser\/sistema operativo.*implementazione locale o remota/isu.test(await page.locator("[data-browser-tts]").innerText())) throw new Error("TTS remote/platform limitation disclosure missing");
        const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        if (horizontalOverflow) throw new Error("browser-text-to-speech horizontal overflow at 390px");
        results.push({ toolId: "browser-text-to-speech", status: "PASS", ...audit.assert("browser-text-to-speech"), horizontalOverflow: false, speechSynthesisAvailable: true, scope: "runtime browser SpeechSynthesis handoff; voice availability/implementation may be remote and is explicitly outside Strumentini certification" });
        await page.close();
        await ttsContext.close();
      }
    } finally {
      await context.close();
    }
    const receipt = {
      schemaVersion: 1,
      status: "PASS",
      tools: results.map(({ toolId }) => toolId),
      mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
      network: "zero external/non-GET/task-body requests after user action",
      results,
    };
    const outputDir = resolve(root, "quality/receipts/browser-audio");
    await mkdir(outputDir, { recursive: true });
    await writeFile(resolve(outputDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    console.log("browser audio acceptance PASS: audio-generator + browser-text-to-speech");
  } finally {
    await browser.close();
  }
} finally {
  server?.kill("SIGTERM");
}
