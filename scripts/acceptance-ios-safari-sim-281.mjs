/**
 * STR-281: simulated mobile Safari heavy-route acceptance against built dist.
 * WebKit here runs on macOS Playwright, NOT inside a physical iPhone or iOS Simulator.
 * Run after build + scripts/generate-image-resize-physical-fixtures.ts.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { webkit, devices } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const receiptPath = resolve(process.env.IOS281_RECEIPT ?? resolve(root, "quality/receipts/ios-safari-simulated-281.json"));
const routeNames = ["/tools/image-resize/", "/tools/audio-generator/"];
const sha = (data) => createHash("sha256").update(data).digest("hex");
const mime = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png",
  ".woff2": "font/woff2", ".wasm": "application/wasm" };
const memoryLimitation = "Safari does not expose reliable per-tab peak JS/WASM/canvas memory; decoded memory is an application-policy estimate, not a measured browser peak.";
const shareLimitation = "Native iOS Share sheet, Files/Photos picker, and Files-app reopening cannot be observed from macOS Playwright WebKit.";

function makeServer() {
  return createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
      const filePath = resolve(dist, pathname.replace(/^\/+/u, ""), pathname.endsWith("/") ? "index.html" : "");
      if (!filePath.startsWith(dist + sep)) { res.writeHead(403).end("forbidden"); return; }
      const info = await stat(filePath);
      const file = info.isDirectory() ? resolve(filePath, "index.html") : filePath;
      const bytes = await readFile(file);
      res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store" }).end(bytes);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
}

function trackPage(page, origin) {
  const offsite = [];
  const uploads = [];
  const pageErrors = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!(url.startsWith(origin + "/") || url.startsWith("blob:") || url.startsWith("data:"))) offsite.push(url);
    if (!["GET", "HEAD"].includes(request.method())) uploads.push({ method: request.method(), url });
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { offsite, uploads, pageErrors };
}

function common(route, tracked, estimatedBytes, hardLimitBytes) {
  return {
    route, status: "PASS",
    picker: { mechanism: "playwright-setInputFiles", nativeIosPickerObserved: false, selection: "PASS" },
    memory: { measurement: "POLICY_ESTIMATE_ONLY", estimatedBytes,
      hardLimitBytes, observedPeakBytes: null, limitation: memoryLimitation },
    share: { status: "NOT_RUN", limitation: shareLimitation },
    network: { offsite: tracked.offsite, uploads: tracked.uploads },
  };
}

async function runImage(browser, origin, manifest) {
  const context = await browser.newContext({ ...devices["iPhone 17"], acceptDownloads: true });
  try {
    const page = await context.newPage();
    const network = trackPage(page, origin);
    const response = await page.goto(origin + "/tools/image-resize/", { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    const input = page.locator("#image-resize-file");
    await input.waitFor();
    await input.setInputFiles({ name: "corrupt.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(128, 42) });
    await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator("a[download]").count(), 0, "corrupt source cannot expose a download");

    const source = resolve(dist, "physical-fixtures", manifest.filename);
    assert.equal(sha(await readFile(source)), manifest.sha256, "16MP fixture changed");
    const sourceBytes = (await stat(source)).size;
    await input.setInputFiles(source);
    await page.locator("[data-resize-estimate]").getByText(/Originale/u).waitFor().catch(async () => {
      await page.locator("[data-resize-estimate]").waitFor();
    });
    const estimate = await page.locator("[data-resize-estimate]").innerText();
    assert(estimate.includes(String(manifest.source.width)) && estimate.includes(String(manifest.source.height)));
    await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
    let cancelled = "NOT_OBSERVED";
    let cancelLimitation = "The image job completed before a cancellable UI state could be intercepted in this WebKit run.";
    try {
      await page.getByRole("button", { name: "Annulla", exact: true }).click({ timeout: 2500 });
      await page.getByRole("alert").getByText(/annullata/u).waitFor({ timeout: 3000 });
      cancelled = "PASS";
      cancelLimitation = undefined;
    } catch {
      // A very fast image run can finish before the cancel button is actionable.
    }
    await input.setInputFiles(source);
    await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
    const link = page.locator("a[download]").first();
    await link.waitFor({ timeout: 60_000 });
    const href = await link.getAttribute("href");
    assert(href?.startsWith("blob:"), "image output must be a local Blob");
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), link.click()]);
    const bytes = await readFile(await download.path());
    const metadata = await sharp(bytes).metadata(); // independently reopen the downloaded artifact
    assert.equal(metadata.width, manifest.recommendedOutput.width);
    assert.equal(metadata.height, manifest.recommendedOutput.height);
    assert.equal(metadata.format, "jpeg");
    assert.equal(network.pageErrors.length, 0, network.pageErrors.join("; "));
    assert.deepEqual(network.offsite, []);
    assert.deepEqual(network.uploads, []);
    return {
      ...common("/tools/image-resize/", network, manifest.estimatedDecodedBytes,
        manifest.policyLimits.maxEstimatedDecodedBytes),
      source: { bytes: sourceBytes, dimensions: manifest.source,
        fixtureSha256: manifest.sha256, thresholdCoverage: manifest.thresholdCoverage },
      recovery: { invalidInput: "PASS", cancel: cancelled, retry: "PASS",
        ...(cancelLimitation ? { cancelLimitation } : {}) },
      download: { filename: download.suggestedFilename(), bytes: bytes.length, sha256: sha(bytes),
        blobHref: true, reopenedIndependently: "PASS", format: metadata.format,
        width: metadata.width, height: metadata.height },
    };
  } finally { await context.close(); }
}

function wav(rate = 8000, seconds = 1) {
  const frames = rate * seconds;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) bytes.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * 440 * i / rate)), 44 + i * 2);
  return bytes;
}

async function runAudio(browser, origin) {
  const context = await browser.newContext({ ...devices["iPhone 17"], acceptDownloads: true });
  await context.addInitScript(() => {
    const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
    window.__ios281BlobUrls = [];
    URL.createObjectURL = (blob) => {
      const url = nativeCreateObjectURL(blob);
      window.__ios281BlobUrls.push({ scheme: url.slice(0, 5), bytes: blob.size, mime: blob.type });
      return url;
    };
    const NativeWorker = window.Worker;
    window.__ios281Workers = { held: 0, created: 0, terminated: 0, holdNext: false };
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.isAudio = String(url).includes("231");
        if (this.isAudio) window.__ios281Workers.created++;
      }
      postMessage(message, ...rest) {
        if (this.isAudio && message?.kind === "render" && window.__ios281Workers.holdNext) {
          window.__ios281Workers.holdNext = false;
          window.__ios281Workers.held++;
          return;
        }
        return super.postMessage(message, ...rest);
      }
      terminate() {
        if (this.isAudio) window.__ios281Workers.terminated++;
        return super.terminate();
      }
    };
  });
  try {
    const page = await context.newPage();
    const network = trackPage(page, origin);
    const response = await page.goto(origin + "/tools/audio-generator/", { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    const panel = page.locator("[data-audio-timeline-231]");
    await panel.waitFor();
    const picker = panel.locator('input[type="file"]');
    const action = panel.getByRole("button", { name: "Elabora e mostra waveform" });
    await picker.setInputFiles({ name: "invalid.wav", mimeType: "audio/wav", buffer: Buffer.alloc(48, 0) });
    await action.click();
    await page.waitForFunction(() => /AUDIO_231_[A-Z_]+/u.test(document.querySelector("[data-audio-timeline-status]")?.textContent ?? ""), null,
      { timeout: 15000 });
    assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0);

    const source = wav();
    await picker.setInputFiles({ name: "440hz.wav", mimeType: "audio/wav", buffer: source });
    await page.evaluate(() => { window.__ios281Workers.holdNext = true; });
    await action.click();
    await page.waitForFunction(() => window.__ios281Workers.held === 1, null, { timeout: 15000 });
    await panel.getByRole("button", { name: "Annulla montaggio" }).click();
    assert.match(await panel.locator("[data-audio-timeline-status]").innerText(), /AUDIO_231_CANCELLED/u);
    assert.equal(await panel.locator("[data-audio-timeline-result]").count(), 0);

    await action.click();
    await panel.locator("[data-audio-timeline-result]").waitFor({ timeout: 30000 });
    const button = panel.getByRole("button", { name: "Scarica WAV PCM16 verificato" });
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), button.click()]);
    const bytes = await readFile(await download.path());
    const blobUrls = await page.evaluate(() => window.__ios281BlobUrls);
    assert(blobUrls.some((entry) => entry.scheme === "blob:" && entry.bytes === bytes.length && entry.mime === "audio/wav"),
      "download bytes must originate from a local WAV Blob");
    // Reopen the actual download independently of the web UI/Worker.
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
    assert.equal(bytes.readUInt16LE(20), 1);
    assert.equal(bytes.readUInt16LE(34), 16);
    assert.equal(bytes.readUInt32LE(24), 8000);
    assert.equal(bytes.readUInt32LE(40), 16000);
    assert.equal(bytes.length, 16044);
    const workers = await page.evaluate(() => ({ ...window.__ios281Workers }));
    assert(workers.created >= 2 && workers.terminated === workers.created);
    assert.equal(network.pageErrors.length, 0, network.pageErrors.join("; "));
    assert.deepEqual(network.offsite, []);
    assert.deepEqual(network.uploads, []);
    return {
      ...common("/tools/audio-generator/", network, source.length + bytes.length, 24 * 1024 * 1024),
      source: { bytes: source.length, sampleRate: 8000, frames: 8000 },
      recovery: { invalidInput: "PASS", cancel: "PASS", retry: "PASS", workers },
      download: { filename: download.suggestedFilename(), bytes: bytes.length, sha256: sha(bytes),
        blobHref: true, reopenedIndependently: "PASS", format: "RIFF/WAVE PCM16" },
    };
  } finally { await context.close(); }
}

const manifest = JSON.parse(await readFile(resolve(dist, "physical-fixtures/manifest.json"), "utf8"));
const pages = Object.fromEntries(await Promise.all(routeNames.map(async (route) =>
  [route, sha(await readFile(resolve(dist, route.slice(1), "index.html")))])));
const browser = await webkit.launch({ headless: true });
const server = makeServer();
const origin = await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", () => done("http://127.0.0.1:" + server.address().port));
});
const routes = [];
try {
  for (const [route, runner] of [
    [routeNames[0], () => runImage(browser, origin, manifest)],
    [routeNames[1], () => runAudio(browser, origin)],
  ]) {
    try { routes.push(await runner()); }
    catch (error) { routes.push({ route, status: "FAIL", error: error instanceof Error ? error.message : String(error) }); }
  }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
const receipt = {
  schemaVersion: 1, ticket: 109,
  generatedAt: new Date().toISOString(),
  evidenceKind: "SIMULATED_DESKTOP_WEBKIT_MOBILE",
  physicalDeviceObserved: false,
  browser: { platform: "macOS Playwright", engine: "webkit", version: browser.version(), deviceProfile: "iPhone 17" },
  build: {
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    pages, fingerprintSha256: sha(JSON.stringify(pages)),
  },
  routes,
  limitations: [memoryLimitation, shareLimitation,
    "No native iOS Simulator Safari automation session: SafariDriver reported session not created; macOS WebKit emulation cannot prove iOS Safari memory ceilings."],
};
await mkdir(resolve(receiptPath, ".."), { recursive: true });
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ receiptPath, evidenceKind: receipt.evidenceKind, build: receipt.build,
  routes: routes.map((route) => ({ route: route.route, status: route.status,
    cancel: route.recovery?.cancel ?? null, downloadBytes: route.download?.bytes ?? null,
    error: route.error ?? null })) }, null, 2));
if (routes.some((route) => route.status !== "PASS")) process.exitCode = 1;
