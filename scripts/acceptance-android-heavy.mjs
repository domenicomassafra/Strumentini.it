/** STR-280: real compiled routes in Playwright's Android Chrome *browser* emulation.
 * This does not boot Android OS or provide physical-device/OS memory evidence.
 * Run after `npm run build`; independent artifacts are reopened in Node.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, devices } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import sharp from "sharp";
import { tsImport } from "tsx/esm/api";

const root = resolve(import.meta.dirname, "..");
const { validateAndroidHeavyRouteReceipt, androidHeavyPromotionDecision } =
  await tsImport("./lib/android-heavy-receipt.ts", import.meta.url);
const { preflightHeavyLocalJob } = await tsImport("../src/runtime/heavy-preflight.ts", import.meta.url);
const port = Number(process.env.STR280_PORT ?? 18308);
assert(Number.isInteger(port) && port > 1024 && port < 65536);
const origin = `http://127.0.0.1:${port}`;
const outputPath = resolve(root, process.env.STR280_RECEIPT ?? ".astro/acceptance/str-280-android-simulated.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = (path, mime) => ({ path: resolve(root, path), mime });
const inputs = {
  image: source("quality/fixtures/image-format-matrix/source.png", "image/png"),
  pdf: source("quality/fixtures/pdf-gold/simple-2page.pdf", "application/pdf"),
  office: { name: "android-lane.md", mime: "text/markdown", bytes: Buffer.from("# STR-280 verified Office document\n\nAndroid acceptance lane.\n") },
  ocr: source("spikes/heavy-local-feasibility/public/corpus/ocr-it.png", "image/png"),
  media: source("quality/fixtures/video-inspection/video-12fps.mp4", "video/mp4"),
};

async function fixture(info) {
  const bytes = info.bytes ?? await readFile(info.path);
  const name = info.name ?? info.path.split("/").at(-1);
  return { filename: name, mime: info.mime, bytes: bytes.length, sha256: sha256(bytes), file: { name, mimeType: info.mime, buffer: bytes } };
}

async function reopen(download, kind) {
  const bytes = await readFile(await download.path());
  assert(bytes.length > 0, `${kind}: downloaded empty artifact`);
  let verifiedContent = "";
  let reopenedWith = "";
  if (kind === "image" || kind === "media") {
    const info = await sharp(bytes).metadata();
    assert(info.width > 0 && info.height > 0 && ["jpeg", "webp", "png"].includes(info.format));
    verifiedContent = `format=${info.format} width=${info.width} height=${info.height}`;
    reopenedWith = "sharp independent image decoder";
  } else if (kind === "pdf") {
    // The repository targets Node 26; a Node 24 host lacks Uint8Array.toHex.
    // Keep the independent PDF.js parser usable on the installed host as well.
    if (typeof Uint8Array.prototype.toHex !== "function") {
      Object.defineProperty(Uint8Array.prototype, "toHex", { configurable: true, value() { return Buffer.from(this).toString("hex"); } });
    }
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true });
    try {
      const pdf = await task.promise;
      assert(pdf.numPages >= 2, `expected merged PDF pages, got ${pdf.numPages}`);
      verifiedContent = `pages=${pdf.numPages}`;
      reopenedWith = "pdfjs-dist independent PDF parser";
    } finally { await task.destroy(); }
  } else if (kind === "office") {
    const entries = unzipSync(bytes);
    const xml = entries["word/document.xml"];
    assert(xml && /STR-280 verified Office document/u.test(strFromU8(xml)), "DOCX reopen lacked known text");
    verifiedContent = `word/document.xml found; ${Object.keys(entries).length} OOXML entries`;
    reopenedWith = "fflate independent OOXML ZIP reopen";
  } else if (kind === "ocr") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    assert.match(text, /fattura|numero|italian/iu, "OCR text did not contain a recognizable fixture marker");
    verifiedContent = `utf8=${text.length} characters fixtureText=${text.slice(0, 50).replace(/\s+/gu, " ")}`;
    reopenedWith = "independent UTF-8 decoder and source fixture text check";
  }
  return { filename: download.suggestedFilename(), bytes: bytes.length, sha256: sha256(bytes), reopenedWith, verifiedContent };
}

async function waitForServer(server) {
  for (let i = 0; i < 40; i++) {
    if (server.exitCode !== null) throw new Error(`static server exited: ${server.exitCode}`);
    try { if ((await fetch(`${origin}/tools/image-resize/`)).ok) return; } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("compiled static server did not start; run npm run build");
}

async function runCase(browser, className, route, handle) {
  const context = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
  const page = await context.newPage();
  const original = await fixture(inputs[className]);
  const pageErrors = [];
  const external = [];
  page.on("pageerror", (error) => pageErrors.push(String(error.message)));
  await page.route("**/*", async (routeRequest) => {
    const url = routeRequest.request().url();
    if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) {
      external.push({ url, method: routeRequest.request().method() });
      await routeRequest.abort();
    } else await routeRequest.continue();
  });
  const checks = { fileSelected: "NOT_OBSERVED", progress: "NOT_OBSERVED", cancelRecoverable: "NOT_OBSERVED", retrySucceeded: "NOT_OBSERVED", downloadTriggered: "NOT_OBSERVED", independentlyReopened: "NOT_OBSERVED" };
  const limits = [];
  let output = null;
  try {
    const response = await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${route} is unavailable in compiled dist`);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    const usedHeap = async () => {
      const { metrics } = await cdp.send("Performance.getMetrics");
      const bytes = metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value;
      assert(Number.isFinite(bytes) && bytes >= 0, "Chromium JS heap observation unavailable");
      return bytes;
    };
    const usedBeforeBytes = await usedHeap();
    const start = performance.now();
    const result = await handle(page, original.file, checks, limits);
    if (result) {
      output = await reopen(result, className);
      checks.downloadTriggered = "OBSERVED";
      checks.independentlyReopened = "OBSERVED";
    } else if (!limits.length) {
      limits.push({ kind: "OUTPUT_UNAVAILABLE", source: "BROWSER", recoverable: true, detail: "The selected route does not expose a downloadable transformed artifact" });
    }
    const memory = {
      scope: "CHROMIUM_JS_HEAP_ONLY", usedBeforeBytes, usedAfterBytes: await usedHeap(),
      jobElapsedMs: Math.round(performance.now() - start), actualOomObserved: false,
      nativeWasmGpuPeakObserved: false,
    };
    const status = output ? "SIMULATED_PASS" : "LIMIT";
    const receipt = {
      schemaVersion: 1, ticket: "STR-280", status, observedAt: new Date().toISOString(),
      device: { label: "Pixel 7 Playwright descriptor", os: "Android", mode: "PLAYWRIGHT_BROWSER_EMULATION", physicalHardware: "NOT_OBSERVED" },
      browser: { engine: "chromium", version: browser.version(), userAgent: await page.evaluate(() => navigator.userAgent) },
      build: { revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), compiled: true },
      route, input: { class: className, filename: original.filename, mime: original.mime, bytes: original.bytes, sha256: original.sha256 }, memory,
      checks, output, limits, externalRequests: external.length, pageErrors,
    };
    const issues = validateAndroidHeavyRouteReceipt(receipt);
    assert.deepEqual(issues, [], `${route}: receipt validation`);
    return receipt;
  } finally { await context.close(); }
}

async function imageCase(page, file, checks, limits) {
  await page.locator("#image-resize-file").setInputFiles(file);
  await page.locator("[data-resize-estimate]").waitFor();
  checks.fileSelected = "OBSERVED";
  await page.getByLabel("Larghezza").fill("16");
  await page.getByLabel("Altezza").fill("16");
  // Hold one late-loaded script to expose the real cancel/retry controls.
  let hold = true;
  let delayed = false;
  await page.route("**/*.js", async (r) => {
    if (hold && r.request().url().includes("/_astro/")) {
      hold = false; delayed = true;
      await new Promise((done) => setTimeout(done, 450));
    }
    await r.continue();
  });
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  const cancel = page.getByRole("button", { name: "Annulla", exact: true });
  try {
    await cancel.waitFor({ timeout: 2500 });
    checks.progress = "OBSERVED";
    await cancel.click();
    await page.getByRole("alert").filter({ hasText: /annullata/u }).waitFor({ timeout: 5000 });
    checks.cancelRecoverable = "OBSERVED";
    limits.push({ kind: "CANCELLED", source: "BROWSER", recoverable: true, detail: delayed ? "Active lazy chunk cancelled; retry available" : "Active image operation cancelled; retry available" });
  } catch {
    // A fast local job may finish before cancellation becomes actionable.
    limits.push({ kind: "OUTPUT_UNAVAILABLE", source: "BROWSER", recoverable: true, detail: "Cancel control was not observable on this quick fixture" });
  }
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  await page.locator('a[download]').first().waitFor({ timeout: 20000 });
  checks.retrySucceeded = checks.cancelRecoverable === "OBSERVED" ? "OBSERVED" : "NOT_OBSERVED";
  const result = page.waitForEvent("download");
  await page.locator('a[download]').first().click();
  return result;
}

async function pdfCase(page, file, checks) {
  const input = page.locator('form.tool-operation input[type="file"]').first();
  await input.setInputFiles([file, { ...file, name: "second.pdf" }]);
  checks.fileSelected = (await input.evaluate((element) => element.files?.length)) === 2 ? "OBSERVED" : "NOT_OBSERVED";
  await page.locator('form.tool-operation button[type="submit"]').click();
  await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 30000 });
  const download = page.waitForEvent("download");
  await page.locator('a[download]').first().click();
  return download;
}

async function officeCase(page, file, checks) {
  const input = page.locator("[data-office-source]");
  await input.setInputFiles(file);
  checks.fileSelected = (await input.evaluate((element) => element.files?.length)) === 1 ? "OBSERVED" : "NOT_OBSERVED";
  await page.locator("[data-office-submit]").click();
  await page.locator("[data-office-result]").waitFor({ timeout: 45000 });
  const download = page.waitForEvent("download");
  await page.locator("[data-office-download]").click();
  return download;
}

async function ocrCase(page, file, checks, limits) {
  const input = page.locator("#ocr246-file");
  await input.setInputFiles(file);
  await page.locator("[data-ocr-status]").filter({ hasText: /Pronto/u }).waitFor();
  checks.fileSelected = "OBSERVED";
  await page.locator("[data-ocr-run]").click();
  const cancel = page.locator("[data-ocr-cancel]");
  await cancel.waitFor({ state: "visible" });
  await cancel.click({ timeout: 10000 });
  await page.locator("[data-ocr-status]").filter({ hasText: /annullato/u }).waitFor();
  checks.progress = "OBSERVED";
  checks.cancelRecoverable = "OBSERVED";
  limits.push({ kind: "CANCELLED", source: "BROWSER", recoverable: true, detail: "Experimental OCR job cancelled via UI; result cleared, retry action remains available" });
  assert(await page.locator("[data-ocr-run]").isEnabled(), "OCR cannot retry after cancel");
  await page.locator("[data-ocr-run]").click();
  await page.locator("[data-ocr-result]").waitFor({ timeout: 150000 });
  checks.retrySucceeded = "OBSERVED";
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica TXT locale" }).click();
  return download;
}

async function mediaCase(page, file, checks, limits) {
  const input = page.getByLabel("File video MP4");
  await input.setInputFiles(file);
  checks.fileSelected = (await input.evaluate((element) => element.files?.length)) === 1 ? "OBSERVED" : "NOT_OBSERVED";
  await page.getByRole("button", { name: "Analizza metadati" }).click();
  await page.locator("[data-video-inspection]").waitFor({ timeout: 30000 });
  assert.match(await page.locator("[data-video-inspection]").innerText(), /MP4/u);
  const frameSource = page.getByLabel("Video locale (massimo 50 MiB)");
  await frameSource.setInputFiles(file);
  const capture = page.getByRole("button", { name: "Estrai fotogramma PNG" });
  await capture.waitFor({ state: "visible" });
  await capture.waitFor({ state: "attached" });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Estrai fotogramma PNG"));
    return button && !button.disabled;
  }, { timeout: 20000 });
  await capture.click();
  await page.locator("[data-frame-result]").waitFor({ timeout: 45000 });
  checks.progress = "OBSERVED";
  const download = page.waitForEvent("download");
  await page.locator('[data-frame-result] a[download]').click();
  return download;
}

const cases = [
  ["image", "/tools/image-resize/", imageCase],
  ["pdf", "/tools/pdf-merge/", pdfCase],
  ["office", "/documenti-markdown/", officeCase],
  ["ocr", "/tools/ocr-italiano-locale-246/", ocrCase],
  ["media", "/tools/video-inspector/", mediaCase],
];

const policy = { capabilities: { worker: "required", wasm: "required" }, limits: { hardWorkingSetBytes: 1024 } };
const unsupported = preflightHeavyLocalJob(policy, { estimatedWorkingSetBytes: 2048 }, { worker: false, wasm: false, "image-decode": true });
const recovered = preflightHeavyLocalJob(policy, { estimatedWorkingSetBytes: 512 }, { worker: true, wasm: true, "image-decode": true });
assert.equal(unsupported.state, "unsupported");
assert.equal(unsupported.resourceState, "blocked");
assert.equal(recovered.state, "supported");

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser;
try {
  await waitForServer(server);
  browser = await chromium.launch({ headless: true });
  const receipts = [];
  for (const [kind, route, handler] of cases) {
    const receipt = await runCase(browser, kind, route, handler);
    receipts.push(receipt);
    console.log(`STR-280 ${kind}: ${receipt.status} route=${route} output=${receipt.output?.bytes ?? 0} bytes reopened=${receipt.checks.independentlyReopened}`);
  }
  assert.deepEqual(receipts.filter((r) => r.status !== "SIMULATED_PASS").map((r) => r.input.class), [], "all five file routes require verified downloadable output");
  assert(receipts.some((r) => r.checks.cancelRecoverable === "OBSERVED"), "no browser cancel recovery observed");
  const suite = {
    schemaVersion: 1, ticket: "STR-280", status: "SIMULATED_LANE_PASS", observedAt: new Date().toISOString(),
    runner: "Playwright Android Pixel 7 browser emulation; Android OS/emulator and physical memory NOT_OBSERVED",
    historicalGate: "STR-206 PHYSICAL_NO_GO; simulated receipts are never physical Gold evidence",
    controlledPreflight: { classification: "injected limit, NOT measured process OOM", blocked: unsupported, retry: recovered },
    promotionDecisions: receipts.map((receipt) => ({ route: receipt.route, ...androidHeavyPromotionDecision(receipt) })),
    routes: receipts,
  };
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, JSON.stringify(suite, null, 2) + "\n");
  const reopened = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(reopened.routes.length, cases.length);
  reopened.routes.forEach((receipt) => assert.deepEqual(validateAndroidHeavyRouteReceipt(receipt), []));
  console.log(`STR-280 SIMULATED_LANE_PASS receipts=${receipts.length} output=${outputPath} reopened=PASS physical=NO_GO`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
