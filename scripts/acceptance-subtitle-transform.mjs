import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18158;
const suppliedOrigin = process.env.SUBTITLE_ACCEPTANCE_ORIGIN?.replace(/\/$/u, "");
const origin = suppliedOrigin ?? `http://127.0.0.1:${port}`;
const server = suppliedOrigin === undefined
  ? spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" })
  : null;
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
    }
    await sleep(100);
  }
  throw new Error(`subtitle acceptance server did not become ready at ${origin}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const taskRequests = [];
  let capture = false;
  page.on("request", (request) => {
    if (capture) taskRequests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });

  const response = await page.goto(`${origin}/tools/subtitle-srt-vtt-transform/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`subtitle route returned HTTP ${response?.status()}`);
  await page.locator('[data-tool-page="subtitle-srt-vtt-transform"][data-runtime="LOCAL"][data-network="forbidden"]').waitFor();
  capture = true;

  const source = page.getByLabel("Sottotitoli SRT o WebVTT");
  await source.fill(`1
00:00:01,000 --> 00:00:03,000
Ciao, mondo 👋
Seconda riga

2
00:00:03,500 --> 00:00:05,000
Perché l’accento resta.
`);
  await page.getByRole("button", { name: "Elabora sottotitoli", exact: true }).click();
  await page.locator('.result-panel[data-state="success"] [data-result-slot="selectable-output"]').waitFor();
  const previewText = await page.locator('[data-result-slot="selectable-output"]').innerText();
  if (!previewText.includes("WEBVTT") || !previewText.includes("Ciao, mondo 👋")) throw new Error("bounded VTT preview missing expected Unicode content");

  const [subtitleDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('button[data-result-action="download"]').click(),
  ]);
  if (subtitleDownload.suggestedFilename() !== "sottotitoli.vtt") throw new Error(`unexpected subtitle filename ${subtitleDownload.suggestedFilename()}`);
  const subtitlePath = await subtitleDownload.path();
  if (subtitlePath === null) throw new Error("subtitle download had no local path");
  const fullVtt = await readFile(subtitlePath, "utf8");
  if (!fullVtt.includes("Perché l’accento resta.") || !fullVtt.endsWith("\n")) throw new Error("complete VTT download was truncated or lost Unicode text");

  const [transcriptDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Scarica trascrizione completa", exact: true }).click(),
  ]);
  const transcriptPath = await transcriptDownload.path();
  if (transcriptPath === null) throw new Error("transcript download had no local path");
  const transcript = await readFile(transcriptPath, "utf8");
  if (transcript !== "Ciao, mondo 👋 Seconda riga\nPerché l’accento resta.\n") throw new Error(`unexpected transcript: ${JSON.stringify(transcript)}`);

  await page.getByLabel("Offset · millisecondi").fill("-1500");
  await page.getByRole("button", { name: "Elabora sottotitoli", exact: true }).click();
  await page.getByText(/policy scelta è 'rifiuta'/u).waitFor();
  await page.getByLabel("Tempi negativi").selectOption("clamp");
  await page.getByRole("button", { name: "Elabora sottotitoli", exact: true }).click();
  await page.locator('.result-panel[data-state="success"]').waitFor();
  await page.getByText(/clamp \+ preserva durata/u).waitFor();

  await source.fill("1\n00:00:01,000 --> nope\nTesto\n");
  await page.getByRole("button", { name: "Elabora sottotitoli", exact: true }).click();
  await page.getByText(/cue 1, riga 2/u).waitFor();

  await page.getByLabel("Offset · millisecondi").fill("0");
  await source.fill(`1\n00:00:00,000 --> ${"9".repeat(310)}:00:00,000\nTesto\n`);
  await page.getByRole("button", { name: "Elabora sottotitoli", exact: true }).click();
  await page.getByText(/La riga di timing non rispetta il formato supportato/u).waitFor();
  if (await page.locator('.result-panel[data-state="success"] [data-result-slot="selectable-output"]').count()) {
    throw new Error("overflowed timing exposed a stale downloadable output");
  }

  await source.fill("1\n00:00:00,000 --> 2000000000:00:00,000\nTesto\n");
  await page.getByLabel("Scala timing").fill("2");
  await page.getByRole("button", { name: "Elabora sottotitoli", exact: true }).click();
  await page.getByText(/intervallo di millisecondi rappresentabili esattamente/u).waitFor();

  await page.getByLabel("Scala timing").fill("1");
  await source.fill("1\n00:00:01,000 --> 00:00:02,000\nRiprova valida\n");
  await page.getByRole("button", { name: "Elabora sottotitoli", exact: true }).click();
  await page.locator('.result-panel[data-state="success"] [data-result-slot="selectable-output"]').waitFor();
  if (!(await page.locator('[data-result-slot="selectable-output"]').innerText()).includes("Riprova valida")) {
    throw new Error("valid retry after timestamp refusal did not restore subtitle output");
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("subtitle editor horizontally overflows at 390px");
  const unsafeRequests = taskRequests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
  if (unsafeRequests.length > 0) throw new Error(`subtitle tool emitted external/write/body requests: ${JSON.stringify(unsafeRequests)}`);

  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    route: "/tools/subtitle-srt-vtt-transform/",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    roundTripSurface: "PASS",
    completeSubtitleDownload: "PASS",
    transcriptDownload: "PASS",
    negativeOffsetRefuseAndClamp: "PASS",
    malformedTimingLocation: "PASS",
    safeIntegerTimecodesAndRetry: "PASS",
    network: "same-origin GET assets only after task start; no task-content request body",
  };
  const receiptDir = resolve(root, "quality/receipts/subtitle-transform");
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  await browser.close();
  console.log("subtitle transform browser acceptance PASS: 390px, VTT/transcript downloads, offset policies, overflow timecode refusal/retry, LOCAL network contract");
} finally {
  server?.kill("SIGTERM");
}
