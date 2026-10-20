/** #124: Android Chrome AVD observations, strictly PARTIAL; no gate promotion. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const scratch = resolve(root, ".tmp-str363-android");
const dist = resolve(root, "dist");
const adbBin = resolve(process.env.HOME ?? "/home/udodo", "Android/Sdk/platform-tools/adb");
const adb = (...args) => execFileSync(adbBin, args, { encoding: "utf8", timeout: 30000 }).trim();
const sha256 = data => createHash("sha256").update(data).digest("hex");
const port = 18124;
const route = "/tools/image-resize/";
const routeBytes = await readFile(resolve(dist, "tools/image-resize/index.html"));
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const runId = `str363-${Date.now()}`;
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
    const destination = resolve(dist, pathname.replace(/^\/+/, ""), pathname.endsWith("/") ? "index.html" : "");
    assert(destination.startsWith(dist + sep));
    const file = (await stat(destination)).isDirectory() ? resolve(destination, "index.html") : destination;
    const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".wasm": "application/wasm" };
    res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end("missing"); }
});

function devicePssKb() {
  const output = adb("shell", "dumpsys", "meminfo", "-d", "com.android.chrome");
  const match = output.match(/^\s*TOTAL\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+/mu);
  assert(match, "Android Chrome main process PSS unavailable");
  return Number(match[1]);
}
async function fixture(width, height) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let p = 0; p < pixels.length; p += 1) pixels[p] = ((p * 131) ^ (p >>> 5) ^ (p >>> 13)) & 255;
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer();
}
const sleep = ms => new Promise(done => setTimeout(done, ms));
const measurementScript = () => {
  if (window.__str363) return;
  let running = false;
  let last = 0;
  let inputTime = null;
  let inputLatency = null;
  let frames = [];
  const tick = t => {
    if (running && last > 0) frames.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener("pointerdown", event => {
    if (!running) return;
    inputTime = event.timeStamp;
    requestAnimationFrame(t => { if (running) inputLatency = Math.max(0, t - inputTime); });
  }, { capture: true });
  window.__str363 = {
    start() { running = true; last = 0; frames = []; inputTime = null; inputLatency = null; this.started = performance.now(); },
    stop() { running = false; return { frameSamples: frames.length, frameMaxIntervalMs: frames.length ? Math.max(...frames) : null, pointerToNextFrameMs: inputLatency, operationElapsedMs: performance.now() - this.started }; },
  };
};

const output = {
  schemaVersion: 1,
  evidenceKind: "ANDROID_EMULATOR_PARTIAL_RAW_UNATTESTED",
  ticket: "STR-363", physicalDeviceObserved: false,
  sourceRevision: revision, route, routeSha256: sha256(routeBytes), runId,
  capturedAt: new Date().toISOString(),
  simulator: { id: adb("get-serialno"), avd: "str277-api35", fingerprint: adb("shell", "getprop", "ro.build.fingerprint"), api: adb("shell", "getprop", "ro.build.version.sdk") },
  browser: { package: "com.android.chrome", version: adb("shell", "dumpsys", "package", "com.android.chrome").match(/versionName=([^\s]+)/u)?.[1] },
  collection: { method: "ADB_DEVICE_TRACE + Chrome CDP", inputSelection: "CDP setInputFiles (Android Chrome executes real resize; native picker not asserted)",
    processMemoryCaveat: "dumpsys meminfo com.android.chrome PSS measures Chrome MAIN PROCESS only; excludes renderer processes; do not treat as total browser memory",
    frameCaveat: "rAF sampled on current page; max interval includes compositor scheduling and CDP automation impact",
    heapCaveat: "CDP Performance.getMetrics JSHeapUsedSize for attached renderer, not total process RSS/PSS" },
  observations: [],
  unresolved: ["iOS Simulator #106 occupied", "PDF/CSV measurements pending", "cancel/background/retry/controlled OOM and reopen across matrix not established", "independent human review of AVD trace required"],
};
await mkdir(scratch, { recursive: true });
assert.equal(adb("shell", "getprop", "sys.boot_completed"), "1");
let browser;
await new Promise(done => server.listen(port, "127.0.0.1", done));
try {
  adb("reverse", `tcp:${port}`, `tcp:${port}`);
  adb("forward", "tcp:9222", "localabstract:chrome_devtools_remote");
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `http://127.0.0.1:${port}${route}`, "com.android.chrome");
  for (let i = 0; i < 20 && !browser; i++) {
    try { browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 3500, noDefaults: true }); }
    catch { await sleep(500); }
  }
  assert(browser, "Native Android Chrome CDP unavailable");
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes(`:${port}${route}`)) ?? context.pages()[0];
  assert(page, "Android Chrome tab unavailable");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const heapBytes = async () => (await cdp.send("Performance.getMetrics")).metrics.find(m => m.name === "JSHeapUsedSize")?.value;
  const res = await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert.equal(res.status(), 200);
  await page.locator("#image-resize-file").waitFor({ timeout: 30000 });
  output.browser.userAgent = await page.evaluate(() => navigator.userAgent);
  assert.match(output.browser.userAgent, /Android.*Chrome\//u);
  const external = [];
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", req => { if (!req.url().startsWith(`http://127.0.0.1:${port}/`) && !/^(blob:|data:)/u.test(req.url())) external.push(req.url()); });
  await page.evaluate(measurementScript);
  for (const [size, width, height] of [["S", 320, 240], ["M", 1280, 960], ["L", 2400, 1800]]) {
    const bytes = await fixture(width, height);
    const sourceFile = resolve(scratch, `${runId}-image-${size}.png`);
    await writeFile(sourceFile, bytes);
    for (const phase of ["cold", "warm"]) {
      if (phase === "cold") {
        await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator("#image-resize-file").waitFor();
        await page.evaluate(measurementScript);
      }
      const name = `${runId}-image-${size}-${phase}.png`;
      const targetW = Math.floor(width / 2), targetH = Math.floor(height / 2);
      await page.locator("#image-resize-file").setInputFiles({ name, mimeType: "image/png", buffer: bytes });
      const numeric = page.locator('input[type="number"]');
      await numeric.nth(0).fill(String(targetW));
      await numeric.nth(1).fill(String(targetH));
      const beforeHeap = await heapBytes();
      const beforePssKb = devicePssKb();
      const heaps = [beforeHeap];
      let sampling = true;
      const poll = async () => { while (sampling) { try { heaps.push(await heapBytes()); } catch { /* record observed values only */ } await sleep(130); } };
      const samplingDone = poll();
      await page.evaluate(() => window.__str363.start());
      await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
      const link = page.locator('a[download]').first();
      await link.waitFor({ timeout: 90000 });
      const browserTiming = await page.evaluate(() => window.__str363.stop());
      sampling = false;
      await samplingDone;
      const afterHeap = await heapBytes();
      heaps.push(afterHeap);
      const afterPssKb = devicePssKb();
      const fileName = await link.getAttribute("download");
      assert(fileName?.endsWith(".jpg"));
      const originalDownload = `/sdcard/Download/${fileName}`;
      await link.click({ noWaitAfter: true });
      let remoteBytes = 0;
      for (let attempt = 0; attempt < 25 && !remoteBytes; attempt++) {
        try { remoteBytes = Number(adb("shell", "stat", "-c", "%s", originalDownload)); }
        catch { await sleep(500); }
      }
      assert(remoteBytes > 0, `Android native download absent: ${fileName}`);
      const pulled = resolve(scratch, `${runId}-${size}-${phase}-download.jpg`);
      adb("pull", originalDownload, pulled);
      const saved = await readFile(pulled);
      const decoded = await sharp(saved, { failOn: "error" }).metadata();
      const pixels = await sharp(saved, { failOn: "error" }).ensureAlpha().raw().toBuffer();
      assert.equal(saved.length, remoteBytes);
      assert.equal(saved.subarray(0, 3).toString("hex"), "ffd8ff");
      assert.deepEqual([decoded.format, decoded.width, decoded.height], ["jpeg", targetW, targetH]);
      assert.equal(pixels.length, targetW * targetH * 4);
      const row = { platform: "ANDROID_EMULATOR", format: "image", size, phase,
        status: "OBSERVED_PARTIAL_REVIEW_REQUIRED", input: { filename: name, bytes: bytes.length, sha256: sha256(bytes), dimensions: [width, height] },
        output: { filename: fileName, path: pulled, bytes: saved.length, sha256: sha256(saved), mime: "image/jpeg", dimensions: [targetW, targetH], decodedPixelBytes: pixels.length, reopenedWith: "sharp/libvips" },
        memory: { metric: "JS_HEAP_BYTES", before: beforeHeap, after: afterHeap, observedPeak: Math.max(...heaps.filter(Number.isFinite)), samples: heaps.filter(Number.isFinite).length },
        chromeMainProcessPssKB: { before: beforePssKb, after: afterPssKb },
        timing: browserTiming, recovery: { cancel: "NOT_RUN", background: "NOT_RUN", retry: "NOT_RUN", controlledOom: "NOT_RUN" },
        pageErrors: [...errors], offsiteRequests: [...external], observedAt: new Date().toISOString() };
      output.observations.push(row);
      await writeFile(resolve(scratch, `${runId}-raw.json`), JSON.stringify(output, null, 2) + "\n");
      console.log("STR363_PARTIAL_OBSERVED", JSON.stringify({ size, phase, bytes: saved.length, memory: row.memory, timing: row.timing, pss: row.chromeMainProcessPssKB }));
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    }
  }
  console.log("STR363_RAW_PATH", resolve(scratch, `${runId}-raw.json`));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
