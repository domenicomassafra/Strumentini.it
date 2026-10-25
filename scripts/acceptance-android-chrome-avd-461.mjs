/** STR-461: Android Emulator Chrome + OS picker/download; evidence is SIMULATED, never physical. */
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
const temp = resolve(root, ".scratch/str461-avd");
const adbBin = process.env.STR461_ADB ??
  (process.platform === "darwin" ? "/opt/homebrew/bin/adb"
    : resolve(process.env.HOME ?? "/home/udodo", "Android/Sdk/platform-tools/adb"));
const port = 18875;
const fixture = resolve(root, "tests/fixtures/android-chrome-avd-277-input.png");
const outputFile = resolve(root, ".scratch/str461-avd-output.jpg");
const receiptFile = resolve(root, ".scratch/str461-avd-receipt.json");
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
    return { text: value("text"), description: value("content-desc"), packageName: value("package"), bounds };
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
assert.match(adb("get-serialno"), /^emulator-\d+$/u,
  "STR-461 requires an Android emulator, not an attached physical device");
assert.equal(adb("shell", "getprop", "sys.boot_completed"), "1", "AVD not booted");
assert.match(adb("shell", "pm", "list", "packages", "com.android.chrome"), /package:com.android.chrome/u);
const source = await readFile(fixture);
const sourceMetadata = await sharp(source).metadata();
assert.deepEqual([sourceMetadata.format, sourceMetadata.width, sourceMetadata.height], ["png", 320, 240]);
const html = await readFile(resolve(dist, "tools/image-resize/index.html"));
let existingSourceHash;
try {
  existingSourceHash = adb("shell", "sha256sum", "/sdcard/Download/str461-source.png").split(/\s+/u)[0];
} catch { /* The source fixture has not been uploaded to this AVD. */ }
if (existingSourceHash) {
  assert.equal(existingSourceHash, fingerprint(source), "refusing to overwrite an existing Android fixture");
} else {
  adb("push", fixture, "/sdcard/Download/str461-source.png");
}
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const browserVersion = adb("shell", "dumpsys", "package", "com.android.chrome").match(/versionName=([^\s]+)/u)?.[1];
assert(browserVersion);
const androidFingerprint = adb("shell", "getprop", "ro.build.fingerprint");
const api = Number(adb("shell", "getprop", "ro.build.version.sdk"));
const avdName = adb("emu", "avd", "name").split(/\r?\n/u)[0];
assert.match(avdName, /^[A-Za-z0-9_.-]+$/u, "running AVD name missing or malformed");
let browser;
let stage = "native-chrome-launch";
await new Promise((done) => server.listen(port, "127.0.0.1", done));
try {
  adb("reverse", `tcp:${port}`, `tcp:${port}`);
  adb("forward", "tcp:19222", "localabstract:chrome_devtools_remote");
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `http://127.0.0.1:${port}/tools/image-resize/`, "com.android.chrome");
  // Chrome creates its remote-debugging socket asynchronously after activity launch.
  let cdpError;
  for (let attempt = 0; attempt < 20 && !browser; attempt++) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:19222", { timeout: 3500, noDefaults: true });
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
  stage = "native-file-picker";
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
    if (names.includes("Images in Downloads") || names.some((n) => n.includes("str461-source.png"))) {
      downloadsOpened = true;
      break;
    }
    if (!names.includes("Open from")) await tapNative("Show roots");
    await sleep(850);
    await tapNative("Downloads");
    await sleep(950);
    const newNames = pickerNodes().map((n) => n.text || n.description).filter(Boolean);
    console.log("AVD_DOWNLOADS_NAV", attempt, newNames.slice(0, 15));
    downloadsOpened = newNames.includes("Images in Downloads") || newNames.some((n) => n.includes("str461-source.png"));
  }
  assert(downloadsOpened, "Android Downloads root could not open");
  await tapNative("str461-source.png");
  await page.waitForFunction(() => document.querySelector("#image-resize-file")?.files?.[0]?.name === "str461-source.png", null, { timeout: 30000 });
  const selected = await page.locator("#image-resize-file").evaluate(async (input) => {
    const file = input.files?.[0];
    if (!file) return null;
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return {
      name: file.name, size: file.size, type: file.type,
      sha256: [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join(""),
    };
  });
  assert.deepEqual(selected, {
    name: "str461-source.png", size: source.length, type: "image/png", sha256: fingerprint(source),
  }, "the actual file delivered through Android's native picker must be byte-identical to the fixture");
  console.log("AVD_FILE_SELECTED str461-source.png");
  stage = "image-resize";
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
  // Do not overwrite an existing Android download or confuse it with new output.
  stage = "android-download";
  let preexistingOutput = false;
  try {
    adb("shell", "stat", "-c", "%s", "/sdcard/Download/" + siteFilename);
    preexistingOutput = true;
  } catch { /* No existing download at this path. */ }
  assert.equal(preexistingOutput, false, "refusing to overwrite a prior Android download");
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

  // Leave the real Chrome app and return through Android's activity manager.
  stage = "background-resume";
  // The Blob/result must survive; this cannot be reproduced by desktop page events.
  adb("shell", "input", "keyevent", "KEYCODE_HOME");
  await sleep(700);
  adb("shell", "am", "start", "-n", "com.android.chrome/org.chromium.chrome.browser.ChromeTabbedActivity");
  await sleep(900);
  assert.equal(await link.getAttribute("href"), href, "background/resume lost the generated Blob");
  assert.equal(await link.getAttribute("download"), siteFilename, "background/resume lost the output identity");
  console.log("AVD_BACKGROUND_RESUME_PRESERVED_RESULT");

  // Android's real share sheet is identified by system package, not a mocked
  stage = "share-sheet";
  // navigator.share() rejection. A missing file-share API stays NOT_RUN.
  let nativeShareSheet = "NOT_RUN";
  const shareAction = page.locator('[data-result-action="share"]');
  if (await shareAction.count()) {
    await shareAction.click();
    await sleep(1500);
    const shareUi = pickerNodes();
    const systemNodes = shareUi.filter((node) => /intentresolver|\.resolver\b/iu.test(node.packageName));
    if (systemNodes.length > 0) {
      nativeShareSheet = "OBSERVED";
      console.log("AVD_NATIVE_SHARE_SHEET", JSON.stringify([...new Set(systemNodes.map((node) => node.packageName))]));
      adb("shell", "input", "keyevent", "KEYCODE_BACK");
      await sleep(500);
      assert.equal(await link.getAttribute("href"), href, "dismissing system share sheet lost output");
    } else {
      console.log("AVD_NATIVE_SHARE_SHEET_NOT_RUN", JSON.stringify(shareUi.map((node) => node.text).filter(Boolean).slice(0, 12)));
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, [], "image-resize page attempted offsite requests");
  // Keep screencap as raw bytes: the regular ADB helper intentionally decodes
  // textual commands to UTF-8, which corrupts arbitrary PNG bytes.
  const capture = execFileSync(adbBin, ["exec-out", "screencap", "-p"],
    { timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(capture.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "ADB did not capture PNG bytes");
  await sharp(capture, { failOn: "error", limitInputPixels: 16_000_000 }).stats();
  const screenshotFile = resolve(root, ".scratch/str461-avd-screenshot.png");
  await writeFile(screenshotFile, capture);

  // Negative native picker: Cancel refuses access to another file after reset.
  stage = "picker-cancel-and-invalid-file";
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#image-resize-file").click({ force: true });
  assert(pickerNodes().some((node) => node.packageName && node.packageName !== "com.android.chrome"),
    "Android native file picker must be visible before OS Back cancels it");
  adb("shell", "input", "keyevent", "KEYCODE_BACK");
  await sleep(600);
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
  console.log("ANDROID_CHROME_AVD_461_NEGATIVES_PASS", JSON.stringify({ pickerCancel: true, malformedJpegRefused: true, offsiteRequests: 0 }));
  await copyFile(resolve(temp, "android-downloaded.jpg"), outputFile);
  const receipt = {
    schemaVersion: 1, ticket: "STR-461", evidenceKind: "ANDROID_EMULATOR_CHROME_SIMULATED", physicalDeviceObserved: false,
    observedAt: new Date().toISOString(),
    emulator: { serial: adb("get-serialno"), avd: avdName, api, fingerprint: androidFingerprint },
    browser: { package: "com.android.chrome", version: browserVersion, userAgent: ua },
    build: { revision, compiled: true, route: "/tools/image-resize/", htmlSha256: fingerprint(html) },
    input: { filename: "str461-source.png", mime: "image/png", bytes: source.length, sha256: fingerprint(source), width: sourceMetadata.width, height: sourceMetadata.height },
    operation: { androidPickerOpened: true, fileSelected: true, resizedInChrome: true, androidDownloadSaved: true, photosPicker: "NOT_RUN", filesPicker: "NOT_RUN", nativeShareSheet, backgroundResume: "OBSERVED", permissionDenial: "NOT_RUN" },
    negative: { pickerCancelledWithoutSelection: true, corruptJpegRefused: true, offsiteRequests: externalRequests.length },
    screenshot: { file: ".scratch/str461-avd-screenshot.png", capture: "ADB_SCREENCAP", kind: "ANDROID_EMULATOR_SCREENSHOT_SIMULATED", bytes: capture.length, sha256: fingerprint(capture) },
    output: { filename: siteFilename, mime: "image/jpeg", bytes: bytes.length, sha256: fingerprint(bytes), width: decoded.width, height: decoded.height, decoder: "sharp/libvips", reopened: true },
  };
  await writeFile(receiptFile, JSON.stringify(receipt, null, 2) + "\n");
  console.log(`ANDROID_CHROME_AVD_461_PARTIAL ${JSON.stringify({ build: revision.slice(0, 12), browser: browserVersion, source: [320, 240, source.length], output: [decoded.width, decoded.height, bytes.length, fingerprint(bytes)], receipt: ".scratch/str461-avd-receipt.json", simulated: true })}`);
  // A successful native Chrome file flow does not prove the ticket's second
  // Photos/Files flow, actual OS permission denial, or iOS Safari acceptance.
  // Fail closed until the complete acceptance matrix has its own OS evidence.
  process.exitCode = 2;
} catch (error) {
  await writeFile(receiptFile, JSON.stringify({
    schemaVersion: 1, ticket: "STR-461", evidenceKind: "ANDROID_EMULATOR_CHROME_SIMULATED",
    physicalDeviceObserved: false, result: "FAIL", observedAt: new Date().toISOString(),
    build: { revision, compiled: true, route: "/tools/image-resize/", htmlSha256: fingerprint(html) },
    emulator: { serial: adb("get-serialno"), api, fingerprint: androidFingerprint },
    browser: { package: "com.android.chrome", version: browserVersion },
    failedStage: stage, error: String(error),
    unverified: { photosPicker: "NOT_RUN", filesPicker: "NOT_RUN",
      permissionDenial: "NOT_RUN", iosSafari: "NOT_RUN" },
  }, null, 2) + "\n");
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
