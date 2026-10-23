/** STR-336 native Android AVD receipt: SIMULATED_DEVICE, never physical hardware. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const out = resolve(root, process.env.STR336_OUT ?? ".scratch/str336-native-avd");
const adbBin = process.env.ADB_BIN ?? resolve(process.env.HOME ?? "/home/udodo", "Android/Sdk/platform-tools/adb");
const port = 18896;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const adb = (...args) => execFileSync(adbBin, args, { encoding: "utf8", timeout: 35000 }).trim();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const mime = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png",
  ".woff2": "font/woff2", ".wasm": "application/wasm", ".json": "application/json" };

function nodes() {
  const dump = adb("shell", "uiautomator", "dump", "/sdcard/str336-window.xml");
  assert.match(dump, /dumped/u, "Android UI hierarchy unavailable");
  const xml = adb("shell", "cat", "/sdcard/str336-window.xml");
  return [...xml.matchAll(/<node\s+[^>]*>/gu)].map(([entry]) => {
    const attr = (name) => (entry.match(new RegExp(name + '="([^"]*)"', "u"))?.[1] ?? "").replaceAll("&amp;", "&");
    const bounds = attr("bounds").match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/u)?.slice(1).map(Number);
    return { text: attr("text"), description: attr("content-desc"), bounds };
  });
}
function labels() {
  return nodes().map((item) => item.text || item.description).filter(Boolean);
}
function tapPoint(x, y) {
  adb("shell", "input", "tap", String(Math.round(x)), String(Math.round(y)));
}
async function tapNative(name, attempts = 8) {
  let seen = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const all = nodes();
      seen = all.map((item) => item.text || item.description).filter(Boolean);
      const match = all.find((item) => item.bounds &&
        (item.text === name || item.description === name || item.description.startsWith(name + ",")));
      if (match) {
        const [x1, y1, x2, y2] = match.bounds;
        tapPoint((x1 + x2) / 2, (y1 + y2) / 2);
        await sleep(900);
        return;
      }
    } catch (error) {
      console.log("STR336_PICKER_RETRY " + String(error).slice(0, 110));
    }
    await sleep(800);
  }
  throw Error("Android UI item absent: " + name + " visible=" + JSON.stringify(seen.slice(0, 30)));
}
async function tapPageElement(page, selector) {
  const rect = await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    element.scrollIntoView({ block: "center" });
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }, selector);
  assert(rect, "Page element missing: " + selector);
  await sleep(400);
  const fresh = await page.evaluate((sel) => {
    const box = document.querySelector(sel).getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }, selector);
  await sleep(250);
  tapPoint(fresh.x + Math.min(fresh.width - 8, Math.max(24, fresh.width * 0.16)),
    fresh.y + fresh.height / 2);
  return fresh;
}
async function openNativePicker(page, selector) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await tapPageElement(page, selector);
    await sleep(1800);
    const shown = labels();
    console.log("STR336_PICKER_OPEN " + attempt + " " + JSON.stringify(shown.slice(-14)));
    if (shown.length && !shown.every((name) => /^127\.0\.0\.1|Strumentini|Cerca|Accedi|Menu/u.test(name))) return;
  }
  throw Error("Android OS picker did not open for " + selector);
}
async function chooseDownloadsFile(filename, viaPhotoPicker) {
  let seen = labels();
  if (viaPhotoPicker) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const names = labels();
      if (names.some((name) => name.includes(filename))) break;
      if (names.includes("Cerca foto")) await sleep(1200);
      seen = names;
      await sleep(900);
    }
    if (labels().some((name) => name.includes(filename))) {
      await tapNative(filename);
      return "PHOTO_PICKER";
    }
  }
  let names = labels();
  if (names.includes("More options")) {
    await tapNative("More options");
    names = labels();
  }
  if (names.includes("Browse…")) await tapNative("Browse…");
  for (let attempt = 0; attempt < 5; attempt++) {
    names = labels();
    if (names.some((name) => name.includes(filename))) break;
    if (names.includes("Show roots")) await tapNative("Show roots");
    if (labels().includes("Downloads")) {
      await tapNative("Downloads");
    } else if (labels().includes("Recent")) {
      await tapNative("Downloads");
    } else {
      await sleep(700);
    }
    await sleep(900);
  }
  names = labels();
  if (!names.some((name) => name.includes(filename))) {
    if (names.includes("Search")) {
      await tapNative("Search");
      adb("shell", "input", "text", filename);
      await sleep(1400);
    }
  }
  await tapNative(filename);
  return "DOCUMENTS_UI";
}
async function shot(label) {
  const bytes = execFileSync(adbBin, ["exec-out", "screencap", "-p"], { timeout: 30000, maxBuffer: 64 * 1024 * 1024 });
  await writeFile(resolve(out, label + ".png"), bytes);
  const small = await sharp(bytes).resize({ width: 300 }).jpeg({ quality: 38 }).toBuffer();
  await writeFile(resolve(out, label + ".jpg"), small);
  return { file: label + ".png", sha256: sha(bytes), bytes: bytes.length,
    preview: { file: label + ".jpg", sha256: sha(small), bytes: small.length } };
}
function downloadStamp(name) {
  try { return adb("shell", "stat", "-c", "%y %s", "/sdcard/Download/" + name); }
  catch { return null; }
}
async function downloaded(name, label, previousStamp) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const stamp = downloadStamp(name);
      const size = Number(adb("shell", "stat", "-c", "%s", "/sdcard/Download/" + name));
      if (size > 100 && stamp && stamp !== previousStamp) {
        const local = resolve(out, label + "-" + name.replace(/[^a-zA-Z0-9.-]/gu, "_"));
        execFileSync(adbBin, ["pull", "/sdcard/Download/" + name, local], { stdio: "pipe", timeout: 30000 });
        const bytes = await readFile(local);
        assert.equal(bytes.length, size, "Pulled file differs from Android DownloadManager");
        return { filename: name, bytes: size, sha256: sha(bytes), path: local, content: bytes };
      }
    } catch { /* DownloadManager may still be writing. */ }
    await sleep(1000);
  }
  throw Error("DownloadManager file missing: " + name + "; " + adb("shell", "ls", "-la", "/sdcard/Download"));
}
async function clickDownload(page, locator) {
  const expectedName = await locator.getAttribute("download");
  assert(expectedName, "Download control must name an output file");
  const previousStamp = downloadStamp(expectedName);
  await page.evaluate(() => {
    window.__str336Names = [];
    document.addEventListener("click", (event) => {
      const anchor = event.target?.closest?.("a[download]");
      if (anchor) window.__str336Names.push(anchor.getAttribute("download"));
    }, true);
  });
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  assert(box, "Download control has no box");
  tapPoint(box.x + box.width / 2, box.y + box.height / 2);
  let name = null;
  for (let attempt = 0; attempt < 15 && !name; attempt++) {
    name = await page.evaluate(() => window.__str336Names?.at(-1) ?? null);
    if (!name) await sleep(400);
  }
  assert(name, "No browser download anchor observed");
  assert.equal(name, expectedName, "Native download must match the requested output");
  return { name, previousStamp };
}
const server = createServer(async (req, res) => {
  try {
    const route = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
    const target = resolve(dist, route.replace(/^\/+/u, ""), route.endsWith("/") ? "index.html" : "");
    if (!target.startsWith(dist + sep)) throw Error("outside dist");
    const file = (await stat(target)).isDirectory() ? resolve(target, "index.html") : target;
    res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end("not found"); }
});
await mkdir(out, { recursive: true });
assert.equal(adb("shell", "getprop", "sys.boot_completed"), "1", "AVD not booted");
assert.match(adb("shell", "pm", "list", "packages", "com.android.chrome"), /com\.android\.chrome/u);
const device = { type: "SIMULATED_DEVICE", os: "Android",
  fingerprint: adb("shell", "getprop", "ro.build.fingerprint"),
  sdk: Number(adb("shell", "getprop", "ro.build.version.sdk")),
  avd: "str277-api35",
  chrome: adb("shell", "dumpsys", "package", "com.android.chrome").match(/versionName=([^\s]+)/u)?.[1] };
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const image = resolve(root, "tests/fixtures/android-chrome-avd-277-input.png");
const pdf = resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf");
adb("push", image, "/sdcard/Download/str336-photo.png");
adb("push", image, "/sdcard/Pictures/str336-photo.png");
adb("push", pdf, "/sdcard/Download/str336-source.pdf");
adb("shell", "am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
  "-d", "file:///sdcard/Pictures/str336-photo.png");
const report = { ticket: 111, issue: "STR-336", claim: "SIMULATED_ANDROID_AVD_CHROME_NATIVE_PICKER",
  revision, build: { revision, compiled: true, origin: "http://127.0.0.1:" + port,
    indexSha256: sha(await readFile(resolve(dist, "index.html"))) },
  observedAt: new Date().toISOString(), device: { ...device,
    identifier: adb("get-serialno"), runtimeVersion: adb("shell", "getprop", "ro.build.version.release"),
    runtimeBuild: device.fingerprint }, observations: [], limitations: [] };
let browser;
await new Promise((ok) => server.listen(port, "127.0.0.1", ok));
try {
  adb("reverse", "tcp:" + port, "tcp:" + port);
  adb("forward", "tcp:9222", "localabstract:chrome_devtools_remote");
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW",
    "-d", "http://127.0.0.1:" + port + "/", "com.android.chrome");
  for (let attempt = 0; attempt < 20 && !browser; attempt++) {
    try { browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 4000, noDefaults: true }); }
    catch { await sleep(1000); }
  }
  assert(browser, "Cannot attach installed Chrome over CDP");
  const context = browser.contexts()[0];
  const page = context.pages().find((item) => item.url().includes("127.0.0.1:" + port)) ?? context.pages()[0];
  assert(page, "No Android Chrome page");
  const errors = [];
  const uploads = [];
  const egress = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) uploads.push(request.method() + " " + request.url());
    if (!request.url().startsWith("http://127.0.0.1:" + port + "/")) egress.push(request.url());
  });
  await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const ua = await page.evaluate(() => navigator.userAgent);
  assert.match(ua, /Android.*Chrome\//u);
  report.device.userAgent = ua;

  await page.locator("[data-home-photos-picker]").waitFor({ timeout: 30000 });
  await openNativePicker(page, "[data-home-photos-picker]");
  const photoPickerKind = await chooseDownloadsFile("str336-photo.png", true);
  await page.getByText(/PNG riconosciuto localmente/u).waitFor({ timeout: 30000 });
  assert.equal(await page.locator("[data-home-photos-picker]").evaluate((input) => input.files?.length ?? 0), 0,
    "Home resets the input after receipt to allow selecting the same photo again");
  report.observations.push({ step: "HOME_PHOTOS_NATIVE_PICKER", result: "PASS", picker: photoPickerKind,
    screenshot: await shot("photos-home") });
  const targets = await page.locator("[data-home-file-action-format]:visible a").evaluateAll((items) =>
    items.map((item) => item.getAttribute("href")));
  assert(targets.includes("/tools/image-resize/"), "Home entry did not route photos to Image Resize");
  await page.locator('a[href="/tools/image-resize/"]:visible').first().click();
  await page.waitForURL(/\/tools\/image-resize\//u);
  await page.locator("#image-resize-file").waitFor({ timeout: 30000 });
  await openNativePicker(page, "#image-resize-file");
  const resizePickerKind = await chooseDownloadsFile("str336-photo.png", true);
  await page.waitForFunction(() => document.querySelector("#image-resize-file")?.files?.[0]?.name ===
    "str336-photo.png", null, { timeout: 30000 });
  await page.locator('form button[type="submit"]').first().click();
  const link = page.locator('[data-result-action="download"]').first();
  await link.waitFor({ state: "visible", timeout: 60000 });
  const { name, previousStamp } = await clickDownload(page, link);
  const result = await downloaded(name, "photo", previousStamp);
  const meta = await sharp(result.content).metadata();
  assert(["jpeg", "png", "webp"].includes(meta.format));
  report.observations.push({ step: "PHOTOS_TO_RESIZE_ANDROID_DOWNLOADMANAGER", result: "PASS",
    picker: resizePickerKind, filename: name, bytes: result.bytes, sha256: result.sha256,
    format: meta.format, width: meta.width, height: meta.height,
    screenshot: await shot("photo-download") });

  const share = page.locator('[data-result-action="share"]');
  if (await share.count()) {
    await share.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const box = await share.first().boundingBox();
    if (box) {
      tapPoint(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(1800);
      const nativeLabels = labels();
      const sheet = nativeLabels.some((label) => /condividi|share with|sharing|nearby|quick share|bluetooth/iu.test(label));
      report.observations.push({ step: "ANDROID_NATIVE_SHARE_SHEET", result: sheet ? "PASS" : "NOT_OBSERVED",
        visibleNativeLabels: nativeLabels.slice(0, 25), screenshot: await shot("share-sheet") });
      adb("shell", "input", "keyevent", "KEYCODE_BACK");
      await sleep(900);
    }
  } else {
    report.limitations.push("Android Chrome did not offer a native share control on this build.");
  }
  assert.equal(await page.locator('[data-result-action="download"]').count(), 1,
    "Download control vanished after native share/sheet dismissal");
  const beforeCancel = await page.locator('[data-result-action="download"]').first().getAttribute("download");
  await openNativePicker(page, "#image-resize-file");
  adb("shell", "input", "keyevent", "KEYCODE_BACK");
  await sleep(1200);
  assert.equal(await page.locator('[data-result-action="download"]').count(), 1,
    "Cancelling native picker lost the previously generated output");
  assert.equal(await page.locator('[data-result-action="download"]').first().getAttribute("download"), beforeCancel);
  adb("shell", "input", "keyevent", "KEYCODE_HOME");
  await sleep(2500);
  adb("shell", "am", "start", "-a", "android.intent.action.MAIN",
    "-c", "android.intent.category.LAUNCHER", "-p", "com.android.chrome");
  await sleep(2500);
  const resumedPages = context.pages();
  const resumed = resumedPages.find((item) => item.url().includes("/tools/image-resize/")) ?? resumedPages.at(-1);
  assert(resumed, "Chrome did not return to the tool page");
  assert.equal(await resumed.locator('[data-result-action="download"]').count(), 1,
    "Background and return lost the previously generated output");
  assert.equal(await resumed.locator('[data-result-action="download"]').first().getAttribute("download"), beforeCancel);
  report.limitations.push("Android native permission denial was not observed; picker cancellation is a separate refusal.");
  report.observations.push({ step: "AC336_2_PICKER_CANCEL_AND_APP_RETURN", result: "PASS",
    outputRetainedAfterCancelAndReturn: true,
    previousFilename: beforeCancel, resumedUrl: resumed.url(), screenshot: await shot("return-from-app") });

  await resumed.goto("http://127.0.0.1:" + port + "/", { waitUntil: "domcontentloaded" });
  await resumed.locator("[data-home-file-picker]").waitFor({ timeout: 30000 });
  await openNativePicker(resumed, "[data-home-file-picker]");
  const filePickerKind = await chooseDownloadsFile("str336-source.pdf", false);
  await resumed.getByText(/PDF riconosciuto localmente/u).waitFor({ timeout: 30000 });
  assert.equal(await resumed.locator("[data-home-file-picker]").evaluate((input) => input.files?.length ?? 0), 0,
    "Home resets the input after receipt to allow selecting the same document again");
  report.observations.push({ step: "HOME_FILES_NATIVE_PICKER", result: "PASS", picker: filePickerKind,
    screenshot: await shot("files-home") });
  await resumed.locator('a[href="/tools/pdf-compression-lite/"]:visible').first().click();
  await resumed.waitForURL(/\/tools\/pdf-compression-lite\//u);
  await resumed.locator('form input[type="file"]').waitFor({ timeout: 30000 });
  await openNativePicker(resumed, 'form input[type="file"]');
  await chooseDownloadsFile("str336-source.pdf", false);
  await resumed.waitForFunction(() => document.querySelector('form input[type="file"]')?.files?.[0]?.name ===
    "str336-source.pdf", null, { timeout: 30000 });
  await resumed.locator('form button[type="submit"]').first().click();
  const pdfLink = resumed.locator('[data-result-action="download"]').first();
  await pdfLink.waitFor({ state: "visible", timeout: 60000 });
  const { name: pdfName, previousStamp: pdfStamp } = await clickDownload(resumed, pdfLink);
  const pdfOutput = await downloaded(pdfName, "pdf", pdfStamp);
  const pdfTask = getDocument({ data: new Uint8Array(pdfOutput.content), disableWorker: true });
  const parsed = await pdfTask.promise;
  assert.equal(parsed.numPages, 2, "Downloaded PDF must reopen with both pages");
  await pdfTask.destroy();
  report.observations.push({ step: "FILES_TO_PDF_ANDROID_DOWNLOADMANAGER", result: "PASS",
    filename: pdfName, bytes: pdfOutput.bytes, sha256: pdfOutput.sha256, pages: parsed.numPages,
    screenshot: await shot("pdf-download") });
  assert.deepEqual(errors, [], "Chrome page errors: " + errors.join("; "));
  assert.deepEqual(uploads, [], "Sensitive file upload attempted: " + uploads.join("; "));
  assert.deepEqual(egress, [], "External request attempted: " + egress.join("; "));
  report.network = { uploads, egress, pageErrors: errors };
  report.result = "PASS";
  console.log("STR336_ANDROID_NATIVE_PASS " + JSON.stringify({ revision: revision.slice(0, 12), steps:
    report.observations.map((item) => item.step) }));
} catch (error) {
  report.result = "FAIL";
  report.error = String(error?.stack ?? error);
  report.observations.push({ step: "FAILURE_SCREENSHOT", screenshot: await shot("failure").catch(() => null) });
  console.error("STR336_ANDROID_NATIVE_FAIL " + report.error);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, "android-avd-evidence.json"), JSON.stringify(report, null, 2) + "\n");
  await browser?.close().catch(() => {});
  await new Promise((ok) => server.close(ok));
  adb("reverse", "--remove", "tcp:" + port);
  adb("forward", "--remove", "tcp:9222");
}
