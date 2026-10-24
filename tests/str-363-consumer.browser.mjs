/** STR-363 compiled consumer exercise. Desktop Chrome on a mobile viewport is NOT emulator evidence. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const port = await new Promise((done, fail) => {
  const probe = createServer();
  probe.once("error", fail);
  probe.listen(0, "127.0.0.1", () => {
    const address = probe.address();
    if (!address || typeof address === "string") return fail(new Error("No test port"));
    probe.close(() => done(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const androidSerial = process.env.STR363_ANDROID_SERIAL;
const adbBin = process.env.ANDROID_HOME
  ? resolve(process.env.ANDROID_HOME, "platform-tools/adb") : "adb";
const adb = (...args) => execFileSync(adbBin, ["-s", androidSerial, ...args], {
  encoding: "utf8", timeout: 30_000, maxBuffer: 3_000_000,
}).trim();
let androidForwardPort;
let androidDownloadDir;
let androidRawDir;
let androidIdentity;
async function chromePss(format, size, phase, stage) {
  const raw = adb("shell", "dumpsys", "meminfo", "com.android.chrome");
  const total = raw.match(/^\s*TOTAL\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+/m);
  assert(total, "Android Chrome main process PSS absent");
  const name = ["meminfo", format, size, phase, stage].join("-") + ".txt";
  await writeFile(resolve(androidRawDir, name), raw, { flag: "wx" });
  return { pssKb: Number(total[1]), rawFile: name, sha256: sha(raw), sampledAt: new Date().toISOString() };
}
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"],
});
let serverError = "";
server.stderr.on("data", data => { serverError += String(data).slice(0, 1000); });
const sleep = ms => new Promise(done => setTimeout(done, ms));

function installFrameProbe() {
  if (window.str363) return; // Warm capture reuses the page sampler.
  const observed = { active: false, last: null, gaps: [], pointer: null, latency: null, start: 0 };
  const frame = time => {
    if (observed.active && observed.last !== null) observed.gaps.push(time - observed.last);
    observed.last = time;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.addEventListener("pointerdown", event => {
    if (!observed.active) return;
    observed.pointer = event.timeStamp;
    requestAnimationFrame(time => { observed.latency = Math.max(0, time - observed.pointer); });
  }, { capture: true });
  window.str363 = {
    begin() { observed.active = true; observed.gaps = []; observed.last = null;
      observed.pointer = null; observed.latency = null; observed.start = performance.now(); },
    finish() { observed.active = false; return {
      samples: observed.gaps.length,
      maxIntervalMs: observed.gaps.length ? Math.max(...observed.gaps) : null,
      intervalsMs: observed.gaps.slice(-1000),
      intervalsTruncated: observed.gaps.length > 1000,
      pointerToFrameMs: observed.latency,
      elapsedMs: performance.now() - observed.start,
    }; },
  };
}

async function fixture(format, size) {
  if (format === "pdf") {
    const count = { S: 1, M: 12, L: 45 }[size];
    const doc = await PDFDocument.create();
    for (let i = 0; i < count; i++) doc.addPage([300, 400]);
    return { bytes: Buffer.from(await doc.save({ useObjectStreams: false })), expected: count,
      name: `str363-${size}.pdf`, mime: "application/pdf" };
  }
  if (format === "image") {
    const side = { S: 320, M: 1280, L: 2400 }[size];
    return { bytes: await sharp({ create: { width: side, height: side, channels: 3,
      background: "#3c73a8" } }).png().toBuffer(), expected: [Math.floor(side / 2), Math.floor(side / 2)],
      name: `str363-${size}.png`, mime: "image/png" };
  }
  const count = { S: 100, M: 5000, L: 30000 }[size];
  const rows = "id,value\n" + Array.from({ length: count }, (_, i) => `${i},row-${i}\n`).join("");
  return { bytes: Buffer.from(rows), expected: count, name: `str363-${size}.csv`, mime: "text/csv" };
}

async function independentlyReopen(format, bytes, filePath, expected) {
  if (format === "pdf") {
    const reopened = await PDFDocument.load(bytes);
    assert.equal(reopened.getPageCount(), expected);
    assert.equal(reopened.getPage(0).getRotation().angle, 90);
  } else if (format === "image") {
    const { format: mime, width, height } = await sharp(bytes, { failOn: "error" }).metadata();
    assert.equal(mime, "jpeg");
    assert.deepEqual([width, height], expected);
    await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  } else {
    const reader = String.raw`import csv,sys,json
with open(sys.argv[1],newline='',encoding='utf-8') as stream:
    rows=list(csv.reader(stream))
assert rows[0]==['id','value']
assert len(rows)-1==int(sys.argv[2])
assert rows[-1]==[str(int(sys.argv[2])-1),'row-'+str(int(sys.argv[2])-1)]
print(json.dumps({'rows':len(rows)-1}))`;
    const result = JSON.parse(execFileSync("python3", ["-c", reader, filePath, String(expected)], {
      encoding: "utf8", timeout: 30_000,
    }));
    assert.equal(result.rows, expected);
  }
}

async function waitForServer() {
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw new Error(`compiled static server exited ${server.exitCode}: ${serverError}`);
    try { if ((await fetch(origin + "/tools/pdf-rotate/", { signal: AbortSignal.timeout(1000) })).ok) return; }
    catch { /* boot */ }
    await sleep(100);
  }
  throw new Error("compiled dist/ server unavailable: " + serverError);
}

async function saveDownload(link, page) {
  if (!androidSerial) {
    const pending = page.waitForEvent("download", { timeout: 30_000 });
    await link.click();
    const path = await (await pending).path();
    assert(path, "Chromium download path unavailable");
    return { path, bytes: await readFile(path) };
  }
  const names = () => new Set(adb("shell", "ls", "-1", "/sdcard/Download").split(/\r?\n/u).filter(Boolean));
  const before = names();
  await link.click({ noWaitAfter: true });
  let fresh = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    await sleep(500);
    fresh = [...names()].filter(name => !before.has(name));
    if (fresh.length === 1 && /^[\w ().-]{1,180}$/u.test(fresh[0])) {
      const remote = "/sdcard/Download/" + fresh[0];
      let bytesOnDevice = 0;
      try { bytesOnDevice = Number(adb("shell", "stat", "-c", "%s", remote)); }
      catch { continue; } // DownloadManager may still be finalizing the file.
      if (bytesOnDevice > 0) {
        const path = join(androidDownloadDir, "download-" + Date.now() + "-" + fresh[0]);
        execFileSync(adbBin, ["-s", androidSerial, "pull", remote, path], {
          encoding: "utf8", timeout: 30_000,
        });
        const bytes = await readFile(path);
        if (bytes.length === bytesOnDevice) return { path, bytes };
      }
    }
  }
  throw new Error("Android download not uniquely observed: " + fresh.length);
}

let browser, context, page;
try {
  await waitForServer();
  if (androidSerial) {
    assert.match(androidSerial, /^emulator-\d+$/u, "Explicit Android emulator serial required");
    assert.equal(adb("get-state"), "device");
    assert.equal(adb("shell", "getprop", "sys.boot_completed"), "1",
      "Emulator must already be booted under exclusive device lock");
    androidDownloadDir = await mkdtemp(join(tmpdir(), "str363-android-download-"));
    const rawRoot = resolve(root, "quality/receipts/mobile-memory-363/observed/raw");
    await mkdir(rawRoot, { recursive: true });
    androidRawDir = await mkdtemp(join(rawRoot, "android-consumer-"));
    androidIdentity = {
      serial: androidSerial,
      fingerprint: adb("shell", "getprop", "ro.build.fingerprint"),
      osVersion: adb("shell", "getprop", "ro.build.version.release"),
      chromeVersion: adb("shell", "dumpsys", "package", "com.android.chrome")
        .match(/\bversionName=([^\s]+)/u)?.[1] ?? "UNKNOWN",
    };
    adb("reverse", "tcp:" + port, "tcp:" + port);
    androidForwardPort = adb("forward", "tcp:0", "localabstract:chrome_devtools_remote");
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d",
      origin + "/tools/image-resize/", "com.android.chrome");
  }
  const endpoint = androidSerial
    ? "http://127.0.0.1:" + androidForwardPort
    : process.env.STR363_CDP_ORIGIN ?? "http://127.0.0.1:17629";
  const local = !androidSerial && process.env.STR363_LOCAL_CHROMIUM === "1";
  browser = local ? await chromium.launch() : await chromium.connectOverCDP(endpoint, { noDefaults: true });
  context = local ? await browser.newContext({ acceptDownloads: true }) : browser.contexts()[0];
  assert(context, "automation-browser context unavailable");
  if (androidSerial) {
    for (let attempt = 0; attempt < 30 && !page; attempt++) {
      page = context.pages().find(candidate => candidate.url().startsWith(origin + "/tools/"));
      if (!page) await sleep(250);
    }
    assert(page, "Android Chrome tab from ACTION_VIEW was not exposed through CDP");
  } else {
    page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
  }
  if (androidSerial) assert.match(await page.evaluate(() => navigator.userAgent),
    /Android.*Chrome\//u, "CDP target is not installed Android Chrome");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const heap = async () => {
    const result = await cdp.send("Performance.getMetrics");
    const used = result.metrics.find(metric => metric.name === "JSHeapUsedSize")?.value;
    assert(Number.isFinite(used) && used > 0, "CDP JS heap metric absent");
    return used;
  };
  const pageErrors = [], offsite = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => {
    const url = request.url();
    if (!url.startsWith(origin + "/") && !/^(blob:|data:|about:)/u.test(url)) offsite.push(url);
  });
  const matrix = [];
  for (const format of ["pdf", "image", "csv"]) {
    for (const size of ["S", "M", "L"]) {
      const input = await fixture(format, size);
      const initialHash = sha(input.bytes);
      for (const phase of ["cold", "warm"]) {
        const route = { pdf: "/tools/pdf-rotate/", image: "/tools/image-resize/", csv: "/tools/csv-cleaner/" }[format];
        if (phase === "cold" || page.url() !== origin + route) {
          const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 40_000 });
          assert.equal(response?.status(), 200);
        }
        await page.waitForFunction(() => [...document.querySelectorAll("astro-island")]
          .every(island => !island.hasAttribute("ssr")), { timeout: 25_000 });
        await page.locator('input[type="file"]').first().waitFor({ timeout: 30_000 });
        await page.evaluate(installFrameProbe);
        await page.locator('input[type="file"]').first().setInputFiles({
          name: "str363-" + Date.now() + "-" + phase + "-" + input.name,
          mimeType: input.mime, buffer: input.bytes,
        });
        if (format === "pdf") await page.locator('input[placeholder="1-3, 5"]').fill("1");
        if (format === "image") {
          const sizeOut = input.expected[0];
          await page.locator('input[type="number"]').nth(0).fill(String(sizeOut));
          await page.locator('input[type="number"]').nth(1).fill(String(sizeOut));
        }
        const before = await heap();
        const pssBefore = androidSerial ? await chromePss(format, size, phase, "before") : null;
        let sampling = true;
        const samples = [before];
        const sampler = (async () => {
          while (sampling) {
            try { samples.push(await heap()); } catch { /* browser may navigate */ }
            await sleep(180);
          }
        })();
        let outputBytes;
        try {
          await page.evaluate(() => window.str363.begin());
          if (format === "pdf") await page.locator('form button[type="submit"]').first().click();
          if (format === "image") await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
          if (format === "csv") await page.getByRole("button", { name: "Pulisci CSV" }).click();
          const selector = format === "csv" ? 'button[data-result-action="download"]' : 'a[download]';
          const link = page.locator(selector).first();
          await link.waitFor({ timeout: 90_000 });
          const timing = await page.evaluate(() => window.str363.finish());
          const saved = await saveDownload(link, page);
          outputBytes = saved.bytes;
          await independentlyReopen(format, outputBytes, saved.path, input.expected);
          assert.equal(sha(input.bytes), initialHash, "original file input changed");
          const after = await heap();
          const pssAfter = androidSerial ? await chromePss(format, size, phase, "after") : null;
          samples.push(after);
          let rawBrowserProbe = null;
          if (androidSerial) {
            const file = ["browser-samples", format, size, phase].join("-") + ".json";
            const bytes = JSON.stringify({
              sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
              format, size, phase, sampledAt: new Date().toISOString(),
              jsHeapBytes: samples, frame: timing,
            }, null, 2) + "\n";
            assert(Buffer.byteLength(bytes) < 20_000, "Raw frame/heap source exceeds per-file limit");
            await writeFile(resolve(androidRawDir, file), bytes, { flag: "wx" });
            rawBrowserProbe = { file, sha256: sha(bytes) };
          }
          const { intervalsMs, ...frameSummary } = timing;
          matrix.push({ platform: androidSerial ? "ANDROID_EMULATOR" : "DESKTOP_CHROMIUM_MOBILE_VIEWPORT_ONLY",
            format, size, phase,
            inputBytes: input.bytes.length, inputSha256: initialHash,
            outputBytes: outputBytes.length, outputSha256: sha(outputBytes),
            memory: { metric: "JSHeapUsedSize_BYTES", before, after, sampledPeak: Math.max(...samples) },
            androidChromeMainProcessPssKb: androidSerial ? { before: pssBefore, after: pssAfter } : null,
            frame: frameSummary, rawBrowserProbe,
            reopenedIndependently: true, recovery: "NOT_RUN_PER_CASE" });
        } finally { sampling = false; await sampler; }
      }
    }
  }
  // A browser cancellation and retry exercises the actual visible image tool. This is
  // supplementary to engine-level PDF/CSV cancellation tests, not an OS OOM claim.
  await page.goto(origin + "/tools/image-resize/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => [...document.querySelectorAll("astro-island")]
    .every(island => !island.hasAttribute("ssr")), { timeout: 25_000 });
  const large = await fixture("image", "L");
  const largeHash = sha(large.bytes);
  await page.locator("#image-resize-file").setInputFiles({ name: large.name, mimeType: large.mime, buffer: large.bytes });
  await page.locator('input[type="number"]').nth(0).fill("1200");
  await page.locator('input[type="number"]').nth(1).fill("1200");
  await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
  const cancel = page.getByRole("button", { name: "Annulla", exact: true });
  await cancel.waitFor({ timeout: 15_000 });
  await cancel.click();
  await page.locator('p.error[role="alert"]').waitFor({ timeout: 15_000 });
  assert.equal(await page.locator('a[download]').count(), 0, "cancel published stale result");
  await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
  const recovered = page.locator('a[download]').first();
  await recovered.waitFor({ timeout: 90_000 });
  const retrySaved = await saveDownload(recovered, page);
  await independentlyReopen("image", retrySaved.bytes, retrySaved.path, [1200, 1200]);
  assert.equal(sha(large.bytes), largeHash, "cancel/retry mutated source image");

  // A controlled refusal exercises the memory budget without inducing device OOM.
  await page.getByLabel("Non ingrandire oltre l'originale").uncheck();
  await page.locator('input[type="number"]').nth(0).fill("9000");
  await page.locator('input[type="number"]').nth(1).fill("9000");
  await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
  const refusal = await page.locator('p.error[role="alert"]').innerText({ timeout: 15_000 });
  assert.match(refusal, /limite|dimension|sicurezza|pixel|memori/iu);
  assert.equal(await page.locator('a[download]').count(), 0, "refusal exposed stale output");
  await page.locator('input[type="number"]').nth(0).fill("1200");
  await page.locator('input[type="number"]').nth(1).fill("1200");
  await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
  await page.locator('a[download]').first().waitFor({ timeout: 90_000 });
  assert.equal(matrix.length, 18);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(offsite, []);
  const report = {
    schemaVersion: 1, ticket: "STR-363",
    status: androidSerial ? "INCOMPLETE_REVIEW_REQUIRED" : "DESKTOP_VIEWPORT_ONLY",
    physicalDeviceObserved: false,
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    browser: browser.version(), device: androidIdentity ?? null,
    viewport: androidSerial ? null : { width: 390, height: 844 },
    routes: Object.fromEntries(await Promise.all(
      Object.entries({ pdf: "/tools/pdf-rotate/", image: "/tools/image-resize/", csv: "/tools/csv-cleaner/" })
        .map(async ([format, route]) => [format, {
          route, compiledHtmlSha256: sha(await readFile(resolve(root, "dist", route.slice(1), "index.html"))),
        }]))),
    limitations: androidSerial
      ? "Installed Android Chrome CDP, scripted file selection, Chrome MAIN PROCESS PSS only; no iOS, native picker, controlled OOM, per-case recovery or independent review"
      : "Desktop Chrome viewport only; no Android/iOS device, process PSS, or physical memory budget claimed",
    observations: matrix,
  };
  if (androidSerial) {
    await writeFile(resolve(androidRawDir, "consumer-partial.json"),
      JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    console.log("STR363_ANDROID_RAW_DIR", androidRawDir);
  }
  console.log(androidSerial
    ? "STR363_ANDROID_EMULATOR_PARTIAL_REVIEW_REQUIRED"
    : "STR363_COMPILED_CONSUMER_DESKTOP_CHROMIUM_PASS", JSON.stringify(report));
} finally {
  if (page && !androidSerial) {
    try { await page.close(); } catch { /* browser may already be gone */ }
  }
  if (!androidSerial && process.env.STR363_LOCAL_CHROMIUM === "1" && browser) await browser.close();
  if (androidSerial) {
    if (androidForwardPort) {
      try { adb("forward", "--remove", "tcp:" + androidForwardPort); }
      catch { /* best-effort owned forward release */ }
    }
    if (androidDownloadDir) {
      try { adb("reverse", "--remove", "tcp:" + port); }
      catch { /* best-effort owned reverse release */ }
    }
  }
  // Leave externally owned CDP browsers running.
  server.kill("SIGTERM");
  await new Promise(done => {
    if (server.exitCode !== null) return done();
    server.once("exit", done);
    setTimeout(done, 1500).unref();
  });
}
// Exit without sending Browser.close to external CDP clients.
await new Promise(resolve => process.stdout.write("", resolve));
process.exit(0);
