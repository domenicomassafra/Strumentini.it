/* STR-363: observed Android Chrome PDF/CSV runs; these remain PARTIAL. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const scratch = resolve(root, ".tmp-str363-pdf-csv");
const adbBin = resolve(process.env.ANDROID_HOME ?? "/home/udodo/Android/Sdk", "platform-tools/adb");
const device = "emulator-5554", port = 18163;
const id = "str363-pdf-csv-" + Date.now();
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const adb = (...args) => execFileSync(adbBin, ["-s", device, ...args], { encoding: "utf8", timeout: 30000, maxBuffer: 3000000 }).trim();
const sleep = ms => new Promise(done => setTimeout(done, ms));
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const routes = { pdf: "/tools/pdf-rotate/", csv: "/tools/csv-cleaner/" };
const routeSha = {};
for (const format of ["pdf", "csv"]) routeSha[format] = sha(await readFile(resolve(dist, routes[format].slice(1), "index.html")));
function memory() {
  const raw = adb("shell", "dumpsys", "meminfo", "com.android.chrome");
  const value = raw.match(/^\s*TOTAL\s+(\d+)\s+\d+\s+\d+\s+\d+\s+(\d+)/m);
  assert(value, "Chrome main-process PSS/RSS unavailable");
  return { pssKb: Number(value[1]), rssKb: Number(value[2]), rawSha256: sha(raw) };
}
function browserProbe() {
  let intervals = [], last, running = false, inputLatency, started;
  const tick = t => {
    if (running && last !== undefined) intervals.push(t - last);
    last = t; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener("pointerdown", e => {
    if (!running) return;
    const t = e.timeStamp;
    requestAnimationFrame(next => { if (running) inputLatency = Math.max(0, next - t); });
  }, { capture: true });
  window.str363Probe = {
    start() { intervals = []; last = undefined; inputLatency = null; started = performance.now(); running = true; },
    stop() { running = false; return { samples: intervals.length,
      maxIntervalMs: intervals.length ? Math.max(...intervals) : null,
      inputLatencyMs: inputLatency, elapsedMs: performance.now() - started }; },
  };
}
async function pdfFixture(count) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let pageIndex = 0; pageIndex < count; pageIndex++) {
    const page = pdf.addPage([300, 400]);
    for (let row = 0; row < 25; row++) {
      page.drawText("STR-363 " + pageIndex + "/" + row + " " + ((pageIndex + 31) * (row + 71)),
        { x: 10, y: 380 - row * 14, size: 8, font });
    }
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
function csvFixture(count) {
  return Buffer.from("id,value,note\n" + Array.from({ length: count },
    (_, i) => String(i) + "," + String(i % 101) + ",record-" + i + "-observable\n").join(""));
}
function verifyCsv(bytes, count) {
  const lines = bytes.toString("utf8").trimEnd().split(/\r?\n/);
  assert.equal(lines[0], "id,value,note");
  assert.equal(lines.length - 1, count);
  assert(lines.slice(1).every(value => /^\d+,\d+,record-\d+-observable$/.test(value)));
  return { rows: lines.length - 1 };
}
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const full = resolve(dist, pathname.replace(/^\/+/, ""), pathname.endsWith("/") ? "index.html" : "");
    assert(full.startsWith(dist + sep));
    const file = (await stat(full)).isDirectory() ? resolve(full, "index.html") : full;
    const extensions = { ".html": "text/html", ".js": "application/javascript",
      ".css": "text/css", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".woff2": "font/woff2" };
    response.writeHead(200, { "content-type": extensions[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end("missing"); }
});
const report = {
  schemaVersion: 1, ticket: "STR-363", evidenceKind: "ANDROID_EMULATOR_PARTIAL_RAW_UNATTESTED",
  physicalDeviceObserved: false, status: "INCOMPLETE_REVIEW_REQUIRED", sourceRevision: revision,
  routeSha, runId: id, observedAt: new Date().toISOString(),
  emulator: { id: device, fingerprint: adb("shell", "getprop", "ro.build.fingerprint"),
    androidVersion: adb("shell", "getprop", "ro.build.version.release"),
    chromeVersion: adb("shell", "dumpsys", "package", "com.android.chrome").match(/versionName=([^\s]+)/)?.[1] },
  scope: "Real installed Android Chrome CDP setInputFiles, input selection is scripted and not native picker",
  memoryScope: "Renderer JS heap sampled via CDP and Chrome MAIN PROCESS sampled PSS/RSS only, not total browser memory",
  timingScope: "rAF and pointer-to-next-frame includes automation/scheduling; no device-universal frame claim",
  observations: [], unresolved: ["iOS #106 exclusive", "cancel/background/retry/OOM/reopen post-background incomplete",
    "Independent review of recorded device session and provenance required"],
};
await mkdir(scratch, { recursive: true });
assert.equal(adb("get-state"), "device");
assert.equal(adb("shell", "getprop", "sys.boot_completed"), "1");
let browser;
await new Promise(done => server.listen(port, "127.0.0.1", done));
try {
  adb("reverse", "tcp:" + port, "tcp:" + port);
  adb("forward", "tcp:9222", "localabstract:chrome_devtools_remote");
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW",
    "-d", "http://127.0.0.1:" + port + routes.pdf, "com.android.chrome");
  for (let attempt = 0; attempt < 20 && !browser; attempt++) {
    try { browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 3500, noDefaults: true }); }
    catch { await sleep(500); }
  }
  assert(browser, "Android Chrome CDP unavailable");
  const context = browser.contexts()[0];
  console.log("STR363_ANDROID_TABS", JSON.stringify(context.pages().map(p => p.url())));
  const page = context.pages().find(p => p.url().includes(":" + port)) ?? context.pages()[0];
  assert(page, "Android Chrome page missing");
  await page.bringToFront();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const heap = async () => (await cdp.send("Performance.getMetrics")).metrics.find(m => m.name === "JSHeapUsedSize")?.value;
  const errors = [], offsite = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (!request.url().startsWith("http://127.0.0.1:" + port + "/") &&
      !/^(blob:|data:)/.test(request.url())) offsite.push(request.url());
  });
  for (const format of process.env.STR363_ONLY_FORMAT ? [process.env.STR363_ONLY_FORMAT] : ["pdf", "csv"]) {
    assert(["pdf", "csv"].includes(format), "Unsupported format filter");
    const sizes = format === "pdf" ? [["S", 1], ["M", 12], ["L", 45]] :
      [["S", 100], ["M", 5000], ["L", 30000]];
    for (const [size, count] of sizes) {
      const input = format === "pdf" ? await pdfFixture(count) : csvFixture(count);
      for (const phase of ["cold", "warm"]) {
        const target = "http://127.0.0.1:" + port + routes[format];
        if (phase === "cold" || !page.url().includes(routes[format])) {
          const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
          assert.equal(response.status(), 200);
          await page.locator('input[type="file"]').first().waitFor({ timeout: 30000 });
        }
        await page.bringToFront();
        await page.evaluate(browserProbe);
        const filename = id + "-" + format + "-" + size + "-" + phase + "." + format;
        await page.locator('input[type="file"]').first().setInputFiles({
          name: filename, mimeType: format === "pdf" ? "application/pdf" : "text/csv", buffer: input,
        });
        if (format === "pdf") await page.locator('input[placeholder="1-3, 5"]').fill("1");
        const beforeHeap = await heap(), beforePss = memory(), heaps = [beforeHeap];
        let sampling = true;
        const sampler = (async () => {
          while (sampling) {
            try { heaps.push(await heap()); } catch {}
            await sleep(130);
          }
        })();
        await page.evaluate(() => window.str363Probe.start());
        if (format === "pdf") await page.locator('form button[type="submit"]').first().click();
        else {
          console.log("STR363_CSV_CLICK_PREFLIGHT", JSON.stringify(await page.evaluate(() => {
            const el = document.querySelector(".tool-submit");
            const rect = el?.getBoundingClientRect();
            return { visibility: document.visibilityState, focus: document.hasFocus(),
              rect: rect && { width: rect.width, height: rect.height, x: rect.x, y: rect.y },
              disabled: el?.disabled, className: el?.className };
          })));
          await page.bringToFront();
          await page.getByRole("button", { name: "Pulisci CSV" }).click({ force: true, timeout: 15000 });
        }
        const download = format === "pdf" ? page.locator('a[download]').first() :
          page.locator('button[data-result-action="download"]').first();
        await download.waitFor({ timeout: 90000 });
        const timing = await page.evaluate(() => window.str363Probe.stop());
        sampling = false;
        await sampler;
        const afterHeap = await heap(), afterPss = memory();
        heaps.push(afterHeap);
        const outputName = format === "pdf" ? await download.getAttribute("download") :
          filename.replace(/\.csv$/, ".clean.csv");
        assert(outputName, "Output filename unavailable");
        await download.click({ noWaitAfter: true });
        const remote = "/sdcard/Download/" + outputName;
        let length = 0;
        for (let attempt = 0; attempt < 30 && length === 0; attempt++) {
          try { length = Number(adb("shell", "stat", "-c", "%s", remote)); } catch { await sleep(500); }
        }
        assert(length > 0, "Native Chrome download missing " + remote);
        const local = resolve(scratch, id + "-" + format + "-" + size + "-" + phase + "-download." + format);
        adb("pull", remote, local);
        const opened = await readFile(local);
        assert.equal(opened.length, length);
        let independent;
        if (format === "pdf") {
          const doc = await PDFDocument.load(opened);
          independent = { pages: doc.getPageCount(), rotatedFirstPageDegrees: doc.getPage(0).getRotation().angle };
          assert.equal(independent.pages, count);
          assert.equal(independent.rotatedFirstPageDegrees, 90);
        } else independent = verifyCsv(opened, count);
        const entry = {
          platform: "ANDROID_EMULATOR", format, size, phase, route: routes[format], routeSha256: routeSha[format],
          status: "OBSERVED_PARTIAL_REVIEW_REQUIRED", coldDefinition: "fresh route navigation, browser process remains warm",
          input: { name: filename, bytes: input.length, sha256: sha(input), expectedCount: count },
          output: { name: outputName, local, bytes: opened.length, sha256: sha(opened),
            independentlyReopened: true, ...independent },
          memory: { metric: "JS_HEAP_BYTES", before: beforeHeap, after: afterHeap,
            sampledPeak: Math.max(...heaps.filter(Number.isFinite)), samples: heaps.filter(Number.isFinite).length },
          mainProcessMemoryKb: { before: beforePss, after: afterPss }, timing,
          errors: [...errors], offsite: [...offsite],
          recovery: { cancel: "NOT_RUN", background: "NOT_RUN", retry: "NOT_RUN", controlledOom: "NOT_RUN" },
          observedAt: new Date().toISOString(),
        };
        report.observations.push(entry);
        await writeFile(resolve(scratch, id + "-" + format + "-" + size + "-" + phase + "-input." + format), input);
        await writeFile(resolve(scratch, id + "-raw.json"), JSON.stringify(report, null, 2) + "\n");
        console.log("STR363_ANDROID_PARTIAL", JSON.stringify({ format, size, phase, inputBytes: input.length,
          outputBytes: opened.length, heapPeak: entry.memory.sampledPeak, timing, independent }));
        assert.deepEqual(errors, []);
        assert.deepEqual(offsite, []);
      }
    }
  }
  console.log("STR363_RAW_PATH", resolve(scratch, id + "-raw.json"));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
