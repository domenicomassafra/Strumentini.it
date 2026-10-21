/**
 * STR-REUSE-55.5 / #279 — mobile Safari-class acceptance for `/tools/qr-reader/`
 * against the built `dist/`.
 *
 * Lane reused from #281 (`scripts/acceptance-ios-safari-sim-281.mjs`): Playwright
 * WebKit on macOS with the `iPhone 17` device profile. This is simulated mobile
 * WebKit — NOT a physical iPhone and NOT an in-simulator Safari session; the
 * receipt says so and `limitations` names what cannot be observed.
 *
 * The photo fixtures come from the independent `qrcode@1.5.4` encoder through
 * `scripts/generate-qr-279-photo-fixtures.mjs`; both are refused by the native
 * decoder and read by the lazy ZXing fallback, so the donor path is exercised.
 *
 * Run after `npm run build`: node scripts/acceptance-qr-reader-279.mjs
 * Receipt: quality/receipts/ios-safari-simulated-279.json (QR279_RECEIPT overrides)
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { devices, webkit } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const fixtureDir = resolve(root, "quality/fixtures/qr-contract");
const receiptPath = resolve(process.env.QR279_RECEIPT ?? resolve(root, "quality/receipts/ios-safari-simulated-279.json"));
const route = "/tools/qr-reader/";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const mime = {
  ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".woff2": "font/woff2", ".wasm": "application/wasm", ".json": "application/json",
};
const memoryLimitation =
  "WebKit exposes no reliable per-tab peak JS/Canvas memory; the memory figure is a policy estimate (fixture bytes + decoded RGBA), not a measured peak.";
const workerLimitation =
  "The ZXing adapter decodes on a main-thread DOM canvas (`decodeFromCanvas`); no Worker is created by design, so worker parity is not applicable and is asserted as zero constructions.";
const cancelLimitation =
  "The QR reader exposes no cancel control while decoding; cancellation is covered by the AbortError unit test in tests/qr-zxing-279.test.ts, not by this UI run.";
const safariLimitation =
  "Simulated mobile WebKit on macOS, not iOS Safari on a device or in the iOS Simulator: this host has no Simulator.app (Xcode 27 install without it) and SafariDriver 26.6.2 rejects `safari:useSimulator` (session not created), so no in-simulator Safari session can be driven.";

/** Static dist server; `csp: true` adds the strict policy with inline-script hashes. */
function makeServer({ csp = false } = {}) {
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      const filePath = resolve(dist, pathname.replace(/^\/+/u, ""), pathname.endsWith("/") ? "index.html" : "");
      if (!filePath.startsWith(dist + sep)) { response.writeHead(403).end("forbidden"); return; }
      const info = await stat(filePath);
      const file = info.isDirectory() ? resolve(filePath, "index.html") : filePath;
      const bytes = await readFile(file);
      const type = mime[extname(file)] ?? "application/octet-stream";
      response.setHeader("content-type", type);
      response.setHeader("cache-control", "no-store");
      if (csp) {
        const hashes = type === "text/html"
          ? [...bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/giu)]
            .filter((match) => !/\bsrc\s*=/iu.test(match[0]) && match[1] !== "")
            .map((match) => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`)
          : [];
        response.setHeader("content-security-policy",
          `default-src 'self'; script-src 'self' ${hashes.join(" ")}; connect-src 'none'; object-src 'none'; ` +
          "base-uri 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'");
      }
      response.writeHead(200).end(bytes);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
}

/** Request accounting plus script bytes, so lazy loading and the network boundary are measured. */
function trackPage(page, origin) {
  const tracker = { offsite: [], writes: [], scripts: [], sizes: new Map(), pageErrors: [] };
  page.on("request", (request) => {
    const url = request.url();
    if (!(url.startsWith(origin + "/") || url.startsWith("blob:") || url.startsWith("data:"))) tracker.offsite.push(url);
    if (!["GET", "HEAD"].includes(request.method())) tracker.writes.push({ method: request.method(), url });
    if (request.resourceType() === "script") tracker.scripts.push(url);
  });
  page.on("response", (response) => {
    if (response.request().resourceType() !== "script") return;
    const header = response.headers()["content-length"];
    if (header !== undefined) tracker.sizes.set(response.url(), Number(header));
  });
  page.on("pageerror", (error) => tracker.pageErrors.push(error.message));
  return tracker;
}

const sumBytes = (tracker, urls) =>
  urls.length === 0 || !urls.every((url) => tracker.sizes.has(url))
    ? null
    : urls.reduce((total, url) => total + (tracker.sizes.get(url) ?? 0), 0);

async function openReader(context, origin) {
  const page = await context.newPage();
  const tracker = trackPage(page, origin);
  const response = await page.goto(origin + route, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, `reader route returned HTTP ${response?.status()}`);
  const form = page.locator("form").first();
  await form.waitFor();
  const picker = form.locator('input[type="file"]');
  await picker.waitFor();
  // The picker is wrapped by its <label class="field">, which is the accessible name source.
  await page.locator("form label.field", { hasText: "Immagine del codice QR" }).first().waitFor();
  const workers = await page.evaluate(() => window.__qr279Workers?.created ?? 0);
  return { page, form, picker, tracker, workers };
}

function assertLocalOnly(tracker) {
  assert.equal(tracker.pageErrors.length, 0, tracker.pageErrors.join("; "));
  assert.deepEqual(tracker.offsite, [], "the reader must not reach any offsite URL");
  assert.deepEqual(tracker.writes, [], "the reader must not upload or POST anything");
}

async function readResult(page) {
  const payload = (await page.locator("pre.json-result").innerText()).trim();
  const fields = await page.locator("dl.assumptions > div").evaluateAll((rows) => Object.fromEntries(rows.map((row) => [
    row.querySelector("dt")?.textContent?.trim() ?? "",
    row.querySelector("dd")?.textContent?.trim() ?? "",
  ])));
  const warnings = (await page.locator("ul.status-list").innerText()).split("\n").map((line) => line.trim()).filter(Boolean);
  return {
    payload,
    metadata: {
      origin: fields["Origine"] ?? null,
      version: fields["Versione"] ?? null,
      errorCorrection: fields["Correzione errori"] ?? null,
      mask: fields["Maschera"] ?? null,
      byteLength: fields["Byte UTF-8"] ?? null,
    },
    warnings,
  };
}

async function decode(context, origin, file) {
  const { page, form, picker, tracker, workers } = await openReader(context, origin);
  const scriptsAtLoad = tracker.scripts.length;
  const bytesAtLoad = sumBytes(tracker, tracker.scripts);
  const source = resolve(fixtureDir, file);
  const fixtureBytes = (await stat(source)).size;
  await picker.setInputFiles(source);
  assert.equal(await page.locator("form input[type='file']").first().evaluate((input) => input.files?.length ?? 0), 1);
  assert.equal(tracker.scripts.length, scriptsAtLoad, "no decoder chunk may load before submit");
  assert(!tracker.scripts.some((url) => /zxing/iu.test(url)), "the ZXing chunk must not be requested before submit");
  const started = Date.now();
  await form.getByRole("button", { name: "Decodifica QR" }).click();
  await page.locator("pre.json-result").waitFor({ timeout: 30_000 });
  const decodeMs = Date.now() - started;
  const observed = await readResult(page);
  const lazyScripts = tracker.scripts.slice(scriptsAtLoad);
  assert(lazyScripts.length > 0, "the ZXing fallback must be requested lazily after submit");
  assert(lazyScripts.some((url) => /zxing-adapter/u.test(url)),
    `the lazy chunk carrying the ZXing adapter must load after submit, saw ${lazyScripts.join(", ")}`);
  assertLocalOnly(tracker);
  const overflowPixels = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.close();
  return {
    file,
    ...observed,
    bytes: { fixture: fixtureBytes, decoderChunksLazy: sumBytes(tracker, lazyScripts), decoderChunksAtLoad: bytesAtLoad },
    timing: { decodeMs },
    lazyLoading: { scriptRequestsAtLoad: scriptsAtLoad, afterSubmit: lazyScripts },
    overflowPixels,
    workerCount: workers,
    network: { offsite: tracker.offsite, writes: tracker.writes },
  };
}

async function expectRefusal(context, origin, file, expected) {
  const { page, form, picker, tracker } = await openReader(context, origin);
  await picker.setInputFiles(resolve(fixtureDir, file));
  await form.getByRole("button", { name: "Decodifica QR" }).click();
  const alert = page.getByRole("alert").filter({ hasText: expected }).first();
  await alert.waitFor({ timeout: 30_000 });
  const text = (await alert.innerText()).trim();
  assert.match(text, expected, `unexpected refusal text: ${text}`);
  assert.equal(await page.locator("pre.json-result").count(), 0, "a refused input cannot show a decoded payload");
  assertLocalOnly(tracker);
  await page.close();
  return { file, refusal: text, decodedPayloadPresent: false };
}

const manifest = JSON.parse(await readFile(resolve(fixtureDir, "qr-279-photo-manifest.json"), "utf8"));
const fixtures = [];
for (const fixture of manifest.fixtures) {
  const bytes = await readFile(resolve(fixtureDir, fixture.file));
  fixtures.push({
    file: fixture.file, payload: fixture.payload, errorCorrectionLevel: fixture.errorCorrectionLevel,
    width: fixture.width, height: fixture.height, sha256: sha(bytes), matchesManifest: sha(bytes) === fixture.sha256,
  });
}
assert(fixtures.every((entry) => entry.matchesManifest), "committed QR fixtures must match their manifest hashes");
const fixtureFor = (file) => fixtures.find((entry) => entry.file === file);

const oversizedPath = resolve(fixtureDir, ".oversized-279.png.tmp");
const blankPath = resolve(fixtureDir, ".blank-279.png.tmp");
const oversizedBytes = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#ffffff" } }).png().toBuffer();
await writeFile(oversizedPath, oversizedBytes);
await writeFile(blankPath, await sharp({ create: { width: 320, height: 320, channels: 3, background: "#ffffff" } }).png().toBuffer());

const pages = { [route]: sha(await readFile(resolve(dist, "tools/qr-reader/index.html"))) };
const server = makeServer();
const cspServer = makeServer({ csp: true });
const origin = await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", () => done(`http://127.0.0.1:${server.address().port}`)); });
const cspOrigin = await new Promise((done, fail) => { cspServer.once("error", fail); cspServer.listen(0, "127.0.0.1", () => done(`http://127.0.0.1:${cspServer.address().port}`)); });

const browser = await webkit.launch({ headless: true });
const browserVersion = browser.version();
const cases = [];
async function runCase(name, options, runner) {
  const context = await browser.newContext({ ...options, acceptDownloads: true });
  await context.addInitScript(() => {
    const Native = window.Worker;
    window.__qr279Workers = { created: 0 };
    window.Worker = class extends Native {
      constructor(...args) { super(...args); window.__qr279Workers.created += 1; }
    };
  });
  process.stderr.write(`[qr279] start ${name}\n`);
  try {
    cases.push({ name, status: "PASS", ...(await runner(context)) });
    process.stderr.write(`[qr279] pass  ${name}\n`);
  } catch (error) {
    cases.push({ name, status: "FAIL", error: error instanceof Error ? error.message : String(error) });
    process.stderr.write(`[qr279] fail  ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
  } finally {
    await context.close();
  }
}

try {
  await runCase("iphone17-photo-ecm", { ...devices["iPhone 17"] }, async (context) => {
    const observed = await decode(context, origin, "photo-ecm-279.jpg");
    const fixture = fixtureFor("photo-ecm-279.jpg");
    assert.equal(observed.payload, fixture.payload, "payload must equal the independent fixture payload");
    assert.equal(observed.metadata.errorCorrection, `Livello ${fixture.errorCorrectionLevel}`);
    assert.equal(observed.metadata.origin, "immagine locale");
    assert.equal(observed.metadata.mask, "non determinata");
    assert.equal(observed.metadata.version, "non determinata dall'immagine");
    assert.equal(observed.metadata.byteLength, String(Buffer.byteLength(fixture.payload, "utf8")));
    assert(observed.warnings.some((line) => /decoder ZXing/u.test(line)), "the ZXing warning must be shown");
    assert(observed.warnings.some((line) => /non determinate/u.test(line)), "the mask/format warning must be shown");
    assert.equal(observed.workerCount, 0, "the adapter must not spawn a Worker");
    assert.equal(observed.overflowPixels, 0, "no horizontal overflow at the iPhone 17 viewport");
    return {
      ...observed,
      deviceProfile: "iPhone 17",
      memory: {
        measurement: "POLICY_ESTIMATE_ONLY",
        estimatedBytes: observed.bytes.fixture + fixture.width * fixture.height * 4,
        hardLimitBytes: 4_000_000 * 4,
        observedPeakBytes: null,
        limitation: memoryLimitation,
      },
      worker: { created: observed.workerCount, limitation: workerLimitation },
      cancellation: { status: "NOT_OBSERVED_IN_UI", limitation: cancelLimitation },
    };
  });

  await runCase("iphone17-photo-lowcontrast", { ...devices["iPhone 17"] }, async (context) => {
    const observed = await decode(context, origin, "photo-lowcontrast-279.jpg");
    const fixture = fixtureFor("photo-lowcontrast-279.jpg");
    assert.equal(observed.payload, fixture.payload);
    assert.equal(observed.metadata.errorCorrection, `Livello ${fixture.errorCorrectionLevel}`);
    return { ...observed, deviceProfile: "iPhone 17" };
  });

  await runCase("viewport-390x844-photo-ecm", { viewport: { width: 390, height: 844 }, hasTouch: true }, async (context) => {
    const observed = await decode(context, origin, "photo-ecm-279.jpg");
    assert.equal(observed.payload, fixtureFor("photo-ecm-279.jpg").payload);
    assert.equal(observed.overflowPixels, 0, "390px regression: no horizontal overflow");
    return { ...observed, viewport: "390x844" };
  });

  await runCase("viewport-1280x844-photo-ecm", { viewport: { width: 1280, height: 844 } }, async (context) => {
    const observed = await decode(context, origin, "photo-ecm-279.jpg");
    assert.equal(observed.payload, fixtureFor("photo-ecm-279.jpg").payload);
    assert.equal(observed.overflowPixels, 0);
    return { ...observed, viewport: "1280x844" };
  });

  await runCase("iphone17-csp-strict-photo-ecm", { ...devices["iPhone 17"] }, async (context) => {
    const observed = await decode(context, cspOrigin, "photo-ecm-279.jpg");
    assert.equal(observed.payload, fixtureFor("photo-ecm-279.jpg").payload);
    return { ...observed, csp: "script-src 'self' + inline hashes; connect-src 'none'" };
  });

  await runCase("iphone17-refuses-oversized-input", { ...devices["iPhone 17"] }, async (context) => ({
    ...(await expectRefusal(context, origin, ".oversized-279.png.tmp", /supera il limite di 4 megapixel/u)),
    input: { width: 2400, height: 1800, bytes: oversizedBytes.length },
  }));

  await runCase("iphone17-refuses-blank-image", { ...devices["iPhone 17"] }, async (context) => ({
    ...(await expectRefusal(context, origin, ".blank-279.png.tmp", /Non riconosco un codice QR/u)),
    input: { width: 320, height: 320 },
  }));
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
  await new Promise((done) => cspServer.close(done));
  await rm(oversizedPath, { force: true });
  await rm(blankPath, { force: true });
}

const receipt = {
  schemaVersion: 1,
  ticket: 279,
  generatedAt: new Date().toISOString(),
  evidenceKind: "SIMULATED_DESKTOP_WEBKIT_MOBILE",
  physicalDeviceObserved: false,
  browser: {
    platform: process.platform === "darwin" ? "macOS Playwright" : `${process.platform} Playwright`,
    engine: "webkit", version: browserVersion, deviceProfile: "iPhone 17",
  },
  build: {
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    pages,
    fingerprintSha256: sha(JSON.stringify(pages)),
  },
  fixtures,
  cases,
  limitations: [safariLimitation, memoryLimitation, workerLimitation, cancelLimitation],
};
await mkdir(resolve(receiptPath, ".."), { recursive: true });
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  receiptPath,
  evidenceKind: receipt.evidenceKind,
  build: receipt.build,
  cases: cases.map((entry) => ({
    name: entry.name, status: entry.status, decodeMs: entry.timing?.decodeMs ?? null,
    lazyScripts: entry.lazyLoading?.afterSubmit?.length ?? null, overflowPixels: entry.overflowPixels ?? null,
    payload: entry.payload ?? null, error: entry.error ?? null,
  })),
}, null, 2));
if (cases.some((entry) => entry.status !== "PASS")) process.exitCode = 1;
