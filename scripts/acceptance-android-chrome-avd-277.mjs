/** STR-277: real Android Emulator / installed Chrome file picker → compiled resize → Android download → Sharp decode. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const temp = resolve(root, ".tmp-str277");
const adbBin = process.env.ANDROID277_ADB ?? resolve(process.env.HOME ?? "/home/udodo", "Android/Sdk/platform-tools/adb");
const port = 18875;
const fixture = resolve(root, "tests/fixtures/android-chrome-avd-277-input.png");
const outputFile = resolve(root, "quality/receipts/android-chrome-avd-277-output.jpg");
const receiptFile = resolve(root, "quality/receipts/android-chrome-avd-277.json");
const fingerprint = (bytes) => createHash("sha256").update(bytes).digest("hex");
const adb = (...args) => execFileSync(adbBin, args, { encoding: "utf8", timeout: 30_000 }).trim();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".wasm": "application/wasm" };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
    const path = resolve(dist, pathname.replace(/^\/+/, ""), pathname.endsWith("/") ? "index.html" : "");
    if (!path.startsWith(dist + sep)) throw new Error("out-of-root path");
    const file = (await stat(path)).isDirectory() ? resolve(path, "index.html") : path;
    res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("not found");
  }
});

function pickerNodes() {
  const status = adb("shell", "uiautomator", "dump", "/sdcard/window.xml");
  assert.match(status, /dumped/u, "Android native picker hierarchy unavailable");
  const xml = adb("shell", "cat", "/sdcard/window.xml");
  return [...xml.matchAll(/<node\s+[^>]*>/gu)].map(([entry]) => {
    const value = (attr) => (entry.match(new RegExp(`${attr}="([^"]*)"`, "u"))?.[1] ?? "").replaceAll("&amp;", "&");
    const bounds = value("bounds").match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/u)?.slice(1).map(Number);
    return { text: value("text"), description: value("content-desc"), bounds };
  });
}

async function tapNative(name, maxTries = 7) {
  let seen = [];
  for (let i = 0; i < maxTries; i++) {
    try {
      const nodes = pickerNodes();
      seen = nodes.filter((n) => n.text || n.description).map((n) => n.text || n.description);
      const node = nodes.find(({ text, description, bounds }) => bounds && (text === name || description === name || description.startsWith(`${name},`)));
      if (node?.bounds) {
        const [x1, y1, x2, y2] = node.bounds;
        adb("shell", "input", "tap", String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2)));
        console.log(`AVD_PICKER_TAP ${name}`);
        await sleep(800);
        return;
      }
    } catch (error) {
      console.log(`AVD_PICKER_RETRY ${name}: ${String(error).slice(0, 95)}`);
    }
    await sleep(900);
  }
  throw new Error(`Android native picker did not display ${name}; visible: ${JSON.stringify(seen).slice(0, 1200)}`);
}

async function waitDownloaded(filename) {
  for (let i = 0; i < 25; i++) {
    try {
      const result = adb("shell", "stat", "-c", "%s", `/sdcard/Download/${filename}`);
      if (Number(result) > 100) return Number(result);
    } catch { /* Chrome may still be saving or showing download permission UI. */ }
    await sleep(1000);
  }
  const names = adb("shell", "ls", "-la", "/sdcard/Download");
  throw new Error(`Android Chrome download missing: ${filename}; Downloads=${names.slice(0, 1100)}`);
}

await mkdir(temp, { recursive: true });
assert.equal(adb("shell", "getprop", "sys.boot_completed"), "1", "AVD not booted");
assert.match(adb("shell", "pm", "list", "packages", "com.android.chrome"), /package:com.android.chrome/u);
const source = await readFile(fixture);
const sourceMetadata = await sharp(source).metadata();
assert.deepEqual([sourceMetadata.format, sourceMetadata.width, sourceMetadata.height], ["png", 320, 240]);
const html = await readFile(resolve(dist, "tools/image-resize/index.html"));
adb("push", fixture, "/sdcard/Download/str277-source.png");
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const browserVersion = adb("shell", "dumpsys", "package", "com.android.chrome").match(/versionName=([^\s]+)/u)?.[1];
assert(browserVersion);
const androidFingerprint = adb("shell", "getprop", "ro.build.fingerprint");
const api = Number(adb("shell", "getprop", "ro.build.version.sdk"));
let browser;
await new Promise((done) => server.listen(port, "127.0.0.1", done));
try {
  adb("reverse", `tcp:${port}`, `tcp:${port}`);
  adb("forward", "tcp:9222", "localabstract:chrome_devtools_remote");
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `http://127.0.0.1:${port}/tools/image-resize/`, "com.android.chrome");
  // Chrome creates its remote-debugging socket asynchronously after activity launch.
  let cdpError;
  for (let attempt = 0; attempt < 20 && !browser; attempt++) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 3500, noDefaults: true });
    } catch (error) {
      cdpError = error;
      await sleep(1000);
    }
  }
  if (!browser) throw cdpError;
  // Playwright's default CDP download directory points to the Linux host;
  // leave Android Chrome's native DownloadManager untouched (Playwright Apache-2.0).
  console.log("AVD_NATIVE_CHROME_DOWNLOAD_BEHAVIOR", "browser-default/noDefaults");
  const context = browser.contexts()[0];
  const page = context.pages().find((item) => item.url().includes("/tools/image-resize/")) ?? context.pages()[0] ?? await context.newPage();
  console.log("AVD_TABS", context.pages().map((item) => item.url()));
  const errors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(`http://127.0.0.1:${port}/`) && !/^(blob:|data:)/u.test(request.url())) {
      externalRequests.push({ method: request.method(), url: request.url() });
    }
  });
  const response = await page.goto(`http://127.0.0.1:${port}/tools/image-resize/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert.equal(response?.status(), 200);
  await page.locator("#image-resize-file").waitFor({ timeout: 30000 });
  await page.bringToFront();
  const ua = await page.evaluate(() => navigator.userAgent);
  assert.match(ua, /Android.*Chrome\//u);
  let nativePickerOpened = false;
  for (let attempt = 0; attempt < 5 && !nativePickerOpened; attempt++) {
    await page.bringToFront();
    await page.locator("#image-resize-file").click({ force: true });
    await sleep(1500);
    try {
      const names = pickerNodes().map((n) => n.text || n.description);
      console.log("AVD_PICKER_OPEN_ATTEMPT", attempt, names.filter(Boolean).slice(-12));
      nativePickerOpened = names.some((n) => ["More options", "Browse…", "Downloads"].includes(n));
    } catch (error) { console.log("AVD_PICKER_OPEN_TRANSIENT", String(error)); }
  }
  assert(nativePickerOpened, "Android native file picker did not open");
  await tapNative("More options");
  await tapNative("Browse…");
  let downloadsOpened = false;
  for (let attempt = 0; attempt < 4 && !downloadsOpened; attempt++) {
    const names = pickerNodes().map((n) => n.text || n.description).filter(Boolean);
    if (names.includes("Images in Downloads") || names.some((n) => n.includes("str277-source.png"))) {
      downloadsOpened = true;
      break;
    }
    if (!names.includes("Open from")) await tapNative("Show roots");
    await sleep(850);
    await tapNative("Downloads");
    await sleep(950);
    const newNames = pickerNodes().map((n) => n.text || n.description).filter(Boolean);
    console.log("AVD_DOWNLOADS_NAV", attempt, newNames.slice(0, 15));
    downloadsOpened = newNames.includes("Images in Downloads") || newNames.some((n) => n.includes("str277-source.png"));
  }
  assert(downloadsOpened, "Android Downloads root could not open");
  await tapNative("str277-source.png");
  await page.waitForFunction(() => document.querySelector("#image-resize-file")?.files?.[0]?.name === "str277-source.png", null, { timeout: 30000 });
  console.log("AVD_FILE_SELECTED str277-source.png");
  const numeric = page.locator('input[type="number"]');
  await numeric.nth(0).fill("160");
  await numeric.nth(1).fill("120");
  await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
  const link = page.locator('a[download]').first();
  await link.waitFor({ timeout: 45000 });
  const href = await link.getAttribute("href");
  assert(href?.startsWith("blob:"), "output must originate from local Blob");
  const siteFilename = await link.getAttribute("download");
  assert.match(siteFilename, /^[\w .()-]+\.jpe?g$/iu, "unexpected image download filename");
  adb("shell", "rm", "-f", "/sdcard/Download/" + siteFilename);
  page.on("download", async (download) => {
    console.log("CDP_DOWNLOAD_EVENT", download.suggestedFilename());
    try { console.log("CDP_DOWNLOAD_PATH", await download.path()); } catch(error) { console.log("CDP_DOWNLOAD_ERROR", String(error)); }
  });
  await link.scrollIntoViewIfNeeded();
  await link.click({ timeout: 15000 });
  console.log("AVD_CHROME_LINK_CLICKED", siteFilename);
  await sleep(1200);
  console.log("AVD_POST_DOWNLOAD_NODES", JSON.stringify(pickerNodes().filter((n) => n.text || n.description).slice(-18)));
  const byteCount = await waitDownloaded(siteFilename);
  adb("pull", `/sdcard/Download/${siteFilename}`, resolve(temp, "android-downloaded.jpg"));
  const bytes = await readFile(resolve(temp, "android-downloaded.jpg"));
  assert.equal(bytes.length, byteCount);
  assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff");
  const decoded = await sharp(bytes, { failOn: "error" }).metadata();
  const decodedPixels = await sharp(bytes, { failOn: "error" }).ensureAlpha().raw().toBuffer();
  assert.equal(decodedPixels.length, decoded.width * decoded.height * 4, "download must fully decode");
  assert.deepEqual([decoded.format, decoded.width, decoded.height], ["jpeg", 160, 120]);
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, [], "image-resize page attempted offsite requests");
  const capture = execFileSync(adbBin, ["exec-out", "screencap", "-p"], { timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
  const smallCapture = await sharp(capture).resize({ width: 280 }).jpeg({ quality: 36 }).toBuffer();
  assert(smallCapture.length < 20_000, "simulated screenshot exceeds agent file budget");
  const screenshotFile = resolve(root, "quality/receipts/android-chrome-avd-277-simulated.jpg");
  await writeFile(screenshotFile, smallCapture);

  // Negative native picker: Cancel refuses access to another file after reset.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#image-resize-file").click({ force: true });
  await tapNative("Cancel");
  const cancelledPicker = await page.locator("#image-resize-file").evaluate((input) => input.files?.length === 0);
  assert.equal(cancelledPicker, true, "native picker cancellation must not select a file");
  assert.equal(await page.locator('a[download]').count(), 0, "cancelled picker must not create output");

  // Negative format: exercise the real Android renderer's refusal with a test-injected
  // corrupt image; the successful source selection above used the native picker.
  await page.locator("#image-resize-file").setInputFiles({
    name: "corrupt.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  });
  await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
  await page.locator('p.error[role="alert"]').waitFor({ timeout: 20000 });
  const formatError = await page.locator('p.error[role="alert"]').innerText();
  assert.match(formatError, /danneggiata|non riuscit|Scegli un'immagine/iu);
  assert.equal(await page.locator('a[download]').count(), 0, "bad format must not produce a download");
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  console.log("ANDROID_CHROME_AVD_277_NEGATIVES_PASS", JSON.stringify({ pickerCancel: true, malformedJpegRefused: true, offsiteRequests: 0 }));
  await copyFile(resolve(temp, "android-downloaded.jpg"), outputFile);
  const receipt = {
    schemaVersion: 1, ticket: "STR-277", evidenceKind: "ANDROID_EMULATOR_CHROME_SIMULATED", physicalDeviceObserved: false,
    observedAt: new Date().toISOString(),
    emulator: { serial: adb("get-serialno"), avd: "str277-api35", api, fingerprint: androidFingerprint },
    browser: { package: "com.android.chrome", version: browserVersion, userAgent: ua },
    build: { revision, compiled: true, route: "/tools/image-resize/", htmlSha256: fingerprint(html) },
    input: { filename: "str277-source.png", mime: "image/png", bytes: source.length, sha256: fingerprint(source), width: sourceMetadata.width, height: sourceMetadata.height },
    operation: { androidPickerOpened: true, fileSelected: true, resizedInChrome: true, androidDownloadSaved: true },
    negative: { pickerCancelledWithoutSelection: true, corruptJpegRefused: true, offsiteRequests: externalRequests.length },
    screenshot: { file: "quality/receipts/android-chrome-avd-277-simulated.jpg", kind: "ANDROID_EMULATOR_SCREENSHOT_SIMULATED", bytes: smallCapture.length, sha256: fingerprint(smallCapture) },
    output: { filename: siteFilename, mime: "image/jpeg", bytes: bytes.length, sha256: fingerprint(bytes), width: decoded.width, height: decoded.height, decoder: "sharp/libvips", reopened: true },
  };
  await writeFile(receiptFile, JSON.stringify(receipt, null, 2) + "\n");
  console.log(`ANDROID_CHROME_AVD_277_PASS ${JSON.stringify({ build: revision.slice(0, 12), browser: browserVersion, source: [320, 240, source.length], output: [decoded.width, decoded.height, bytes.length, fingerprint(bytes)], receipt: "quality/receipts/android-chrome-avd-277.json", simulated: true })}`);
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
