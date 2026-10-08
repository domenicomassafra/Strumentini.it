/**
 * #236 reproducible DESKTOP Chromium benchmark at a mobile-width viewport.
 *
 * Prerequisite: npm run build
 * Run: npx tsx scripts/benchmark-pdf-200-mobile-viewport.ts
 * Optional: STRUMENTINI_PDF_200_PORT=18490 and STRUMENTINI_PDF_200_REPORT=/tmp/pdf-200.json
 *
 * Exactly one headless Chromium browser, 390x844 viewport (isMobile=false),
 * synthetic 200-page vector/text fixture. Full 200-page PNG render at 0.5x,
 * downloaded ZIP reopening, JS heap samples via Chromium CDP, and cancellation
 * of a separate 200-page higher-scale export. Does not measure native canvas,
 * PDF.js worker, GPU, browser process RSS or physical device memory.
 * This deliberately does not close physical/mobile-memory ticket gates.
 */
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { createSimplePdf, inspectPdfBytes } from "../src/engines/pdf";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_200_PORT ?? 18490);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid benchmark port");
const origin = `http://127.0.0.1:${port}`;
const MiB = 1024 * 1024;
const LIMITS = {
  pages: 200,
  fixtureBytes: 2 * MiB,
  totalMs: 120_000,
  cancelledMs: 45_000,
  jsHeapBytes: 512 * MiB,
  zipBytes: 12 * MiB,
  sampleIntervalMs: 250,
} as const;
const report: Record<string, unknown> = {
  benchmark: "pdf-200-mobile-viewport",
  device: "desktop-chromium-headless-390px-viewport",
  physicalDeviceTested: false,
  nativeBrowserMemoryMeasured: false,
  jsHeapMetric: "CDP Performance.getMetrics JSHeapUsedSize (renderer main thread, sampled; not PDF.js worker/native heap)",
  limits: LIMITS,
};

const pdf = Buffer.from(createSimplePdf(
  Array.from({ length: LIMITS.pages }, (_, index) => `PAGE-${index + 1}`),
  { width: 192, height: 144 },
));
if (pdf.byteLength > LIMITS.fixtureBytes || inspectPdfBytes(pdf).pageCount !== LIMITS.pages) {
  throw new Error("200-page fixture exceeds byte limit or is not exactly 200 pages");
}
report.fixture = { bytes: pdf.byteLength, pages: LIMITS.pages, sizePt: [192, 144] };
const upload = { name: "synthetic-200.pdf", mimeType: "application/pdf", buffer: pdf };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root, stdio: "ignore",
});

async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/tools/pdf-to-images/`);
      if (response.status === 200 && (await response.text()).includes("pdf-to-images")) return;
    } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("No current built static PDF route; run npm run build and ensure the port is free");
}

async function loadPage(page: Page, traffic: string[]): Promise<void> {
  page.on("pageerror", (error) => traffic.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) traffic.push(`external: ${url}`);
    if (request.method() !== "GET") traffic.push(`non-GET: ${request.method()} ${url}`);
  });
  const response = await page.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" });
  assert(response?.status() === 200, "PDF export route returned non-200");
  assert(await page.evaluate(() => innerWidth === 390 && document.documentElement.scrollWidth <= 392), "390px viewport has horizontal overflow");
}

async function setUp(page: Page, scale: string): Promise<void> {
  await page.locator('form input[type="file"]').first().setInputFiles(upload);
  await page.getByLabel("Scala render").fill(scale);
  await page.getByLabel("Formato uscita").selectOption("image/png");
  await page.getByLabel("Pagine (facoltativo)").fill(""); // all 200
}

async function sampleHeap(page: Page): Promise<{ stop: () => Promise<{ baseline: number; peak: number; last: number; samples: number }> }> {
  const session = await page.context().newCDPSession(page);
  await session.send("Performance.enable");
  const readings: number[] = [];
  let inflight = false;
  let failed: string | null = null;
  async function sample() {
    if (inflight) return;
    inflight = true;
    try {
      const { metrics } = await session.send("Performance.getMetrics");
      const size = metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value;
      if (typeof size !== "number" || !Number.isFinite(size)) throw new Error("Chromium CDP did not report JSHeapUsedSize");
      readings.push(size);
    } catch (error) {
      failed = error instanceof Error ? error.message : String(error);
    } finally {
      inflight = false;
    }
  }
  await sample();
  const timer = setInterval(() => { void sample(); }, LIMITS.sampleIntervalMs);
  return {
    async stop() {
      clearInterval(timer);
      while (inflight) await new Promise((done) => setTimeout(done, 10));
      await sample();
      await session.detach();
      if (failed !== null) throw new Error(`CDP metric sampling failed: ${failed}`);
      assert(readings.length >= 2, "Not enough real JS heap samples");
      return { baseline: readings[0]!, peak: Math.max(...readings), last: readings.at(-1)!, samples: readings.length };
    },
  };
}

function expectPngDimensions(bytes: Uint8Array, width: number, height: number, name: string): void {
  const data = Buffer.from(bytes);
  assert(data.byteLength > 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `Invalid PNG ${name}`);
  assert(data.readUInt32BE(16) === width && data.readUInt32BE(20) === height, `Wrong dimensions in ${name}`);
}

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let status: "PASS" | "FAIL" = "FAIL";
let failure: string | null = null;
try {
  await ready();
  browser = await chromium.launch({ headless: true, args: ["--enable-precise-memory-info"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: false, acceptDownloads: true });
  const errors: string[] = [];
  try {
    const full = await context.newPage();
    await loadPage(full, errors);
    await setUp(full, "0.5"); // 96x72 pixels per page, bounded on purpose
    const renderSamples = await sampleHeap(full);
    const start = performance.now();
    await full.locator('form button[type="submit"]').first().click();
    try {
      await full.locator('.result-panel[data-state="success"], .result-panel[data-state="error"]').waitFor({ timeout: LIMITS.totalMs });
    } finally {
      const metrics = await renderSamples.stop();
      report.render = { ...(report.render as object ?? {}), ...metrics, durationMs: Math.round(performance.now() - start) };
    }
    assert(await full.locator('.result-panel[data-state="success"]').count() === 1, `200-page export failed: ${(await full.getByRole("alert").allInnerTexts()).join(" ")}`);
    const render = report.render as { peak: number; durationMs: number };
    assert(render.durationMs <= LIMITS.totalMs, `Render time exceeded ${LIMITS.totalMs}ms`);
    assert(render.peak <= LIMITS.jsHeapBytes, `Sampled main-thread JS heap exceeded ${LIMITS.jsHeapBytes} bytes`);
    const downloadEvent = full.waitForEvent("download", { timeout: 20_000 });
    await full.getByRole("link", { name: "Scarica pdf-pages.zip", exact: true }).click();
    const downloaded = await downloadEvent;
    assert(downloaded.suggestedFilename() === "pdf-pages.zip", "Unexpected ZIP download filename");
    const zipBytes = new Uint8Array(await readFile(await downloaded.path()));
    assert(zipBytes.byteLength < LIMITS.zipBytes, "200-page ZIP exceeded bounded benchmark output size");
    const entries = unzipSync(zipBytes);
    const names = Object.keys(entries);
    assert(names.length === LIMITS.pages, `ZIP has ${names.length} files; expected 200`);
    for (let number = 1; number <= LIMITS.pages; number += 1) {
      const name = `page-${String(number).padStart(3, "0")}.png`;
      assert(names[number - 1] === name, `Missing/out-of-order ZIP entry: ${name}`);
      expectPngDimensions(entries[name]!, 96, 72, name);
    }
    report.render = { ...(report.render as object), zipBytes: zipBytes.byteLength, validatedPngs: names.length, pngDimensions: [96, 72] };
    await full.close();

    const cancelled = await context.newPage();
    // Instrument only the test page: the real engine calls HTMLCanvasElement.toBlob
    // once per rendered PDF page. Wait for three completed PNG encodes to prove
    // cancellation interrupts an in-progress 200-page workload.
    await cancelled.addInitScript(() => {
      const state = window as unknown as { __pdfEncodedPages: number };
      state.__pdfEncodedPages = 0;
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        return original.call(this, (blob) => {
          if (blob?.type === "image/png") state.__pdfEncodedPages += 1;
          callback(blob);
        }, type, quality);
      };
    });
    await loadPage(cancelled, errors);
    await setUp(cancelled, "4"); // 768x576 pixels/page; slow enough to permit real cancellation
    const cancelSamples = await sampleHeap(cancelled);
    const cancelStart = performance.now();
    await cancelled.locator('form button[type="submit"]').first().click();
    const cancelButton = cancelled.getByRole("button", { name: "Annulla", exact: true });
    let pagesEncodedBeforeCancel = 0;
    try {
      await cancelButton.waitFor({ timeout: 10_000 });
      await cancelled.waitForFunction(() => (window as unknown as { __pdfEncodedPages: number }).__pdfEncodedPages >= 3,
        undefined, { timeout: 20_000, polling: 50 });
      pagesEncodedBeforeCancel = await cancelled.evaluate(() => (window as unknown as { __pdfEncodedPages: number }).__pdfEncodedPages);
      assert(pagesEncodedBeforeCancel < LIMITS.pages, "All 200 pages encoded before cancellation was requested");
      await cancelButton.click({ timeout: 10_000 });
      await cancelled.locator('.result-panel[data-state="cancelled"], .result-panel[data-state="success"], .result-panel[data-state="error"]').waitFor({ timeout: LIMITS.cancelledMs });
    } finally {
      const metrics = await cancelSamples.stop();
      report.cancellation = { ...metrics, durationMs: Math.round(performance.now() - cancelStart) };
    }
    assert(await cancelled.locator('.result-panel[data-state="cancelled"]').count() === 1, `Cancellation did not settle in cancelled state: ${(await cancelled.getByRole("alert").allInnerTexts()).join(" ")}`);
    assert(await cancelled.locator('a[download]').count() === 0, "Cancellation left downloadable artifacts");
    await cancelled.waitForTimeout(700);
    assert(await cancelled.locator('.result-panel[data-state="cancelled"]').count() === 1, "Late result replaced cancellation state");
    const cancellation = report.cancellation as { peak: number; durationMs: number };
    assert(cancellation.durationMs <= LIMITS.cancelledMs, `Cancellation took longer than ${LIMITS.cancelledMs}ms`);
    assert(cancellation.peak <= LIMITS.jsHeapBytes, `Cancellation sampled JS heap exceeded ${LIMITS.jsHeapBytes} bytes`);
    report.cancellation = { ...(report.cancellation as object), pageCount: LIMITS.pages, requestedScale: 4,
      pagesEncodedBeforeCancel, pagesEncodedAfterCancel: await cancelled.evaluate(() => (window as unknown as { __pdfEncodedPages: number }).__pdfEncodedPages),
      downloadsExposed: 0, finalState: "cancelled" };
    await cancelled.close();
    assert(errors.length === 0, `Errors or external traffic: ${errors.join(" | ")}`);
    report.requestErrors = errors.length;
    status = "PASS";
  } finally {
    await context.close();
  }
} catch (error) {
  failure = error instanceof Error ? error.stack ?? error.message : String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  report.status = status;
  if (failure !== null) report.failure = failure;
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.env.STRUMENTINI_PDF_200_REPORT) await writeFile(process.env.STRUMENTINI_PDF_200_REPORT, json, "utf8");
  console.log(json);
}
