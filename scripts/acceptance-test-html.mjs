import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const receiptPath = resolve(root, "quality/receipts/test-html-smoke.json");
const sourceTestPage = resolve(root, "test.html");
const testPage = resolve(dist, "test.html");
const port = 18300 + (process.pid % 500);
const origin = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

execFileSync("npm", ["run", "build"], { cwd: root, stdio: "ignore" });
if (!existsSync(testPage) && existsSync(sourceTestPage)) await copyFile(sourceTestPage, testPage);

async function writeReceipt(receipt) {
  await mkdir(resolve(root, "quality/receipts"), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

if (!existsSync(testPage)) {
  await writeReceipt({
    schemaVersion: 1,
    status: "SKIPPED",
    reason: "dist/test.html is not present",
    portableReceipt: "quality/receipts/test-html-smoke.json",
  });
  console.log("test.html smoke SKIPPED: dist/test.html is not present");
  process.exit(0);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
    }
    await sleep(100);
  }
  throw new Error(`static server did not become ready at ${origin}`);
}

async function sourceMapSources(file) {
  const map = await readFile(resolve(dist, "_astro", `${file}.map`), "utf8").catch(() => "");
  if (map === "") return [];
  try {
    const parsed = JSON.parse(map);
    return Array.isArray(parsed.sources) ? parsed.sources.map((source) => String(source)) : [];
  } catch {
    return [];
  }
}

const assetFiles = new Set((await readdir(resolve(dist, "_astro"))).filter((file) => file.endsWith(".js")));
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { cwd: root, stdio: "ignore" });
let browser;
let lastReceipt = null;
try {
  await waitForServer();
  const executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  browser = await chromium.launch({ headless: true, ...(existsSync(executablePath) ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const requests = [];
  let actionStarted = false;
  let longTaskSupported = false;
  const longTasks = [];
  const consoleErrors = [];
  const pageErrors = [];
  await page.addInitScript(() => {
    const state = { supported: false, entries: [] };
    Object.defineProperty(window, "__utilityTestLongTasks", { configurable: true, value: state });
    try {
      if (typeof PerformanceObserver !== "undefined" && Array.isArray(PerformanceObserver.supportedEntryTypes) && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
        state.supported = true;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) state.entries.push({ startTime: entry.startTime, duration: entry.duration });
        });
        observer.observe({ type: "longtask", buffered: true });
      }
    } catch {
    }
  });
  page.on("request", (request) => {
    if (actionStarted || request.resourceType() === "script") {
      requests.push({ url: request.url(), method: request.method(), resourceType: request.resourceType() });
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  const response = await page.goto(`${origin}/test.html`, { waitUntil: "networkidle" });
  const htmlText = await readFile(testPage, "utf8");
  const inlineForbiddenCatalog = /generated\/(?:catalog|tool-loaders)\.ts/u.test(htmlText);
  const initialScripts = requests.filter((request) => request.resourceType === "script").map((request) => basename(new URL(request.url).pathname));
  const initialScriptBytes = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry) => entry.initiatorType === "script")
    .reduce((sum, entry) => sum + entry.decodedBodySize, 0));
  const action = page.locator("[data-smoke-action], button:not([disabled])").first();
  actionStarted = true;
  if (await action.count() > 0) {
    await action.click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(150);
  }
  const actionScripts = requests.filter((request) => request.resourceType === "script").map((request) => basename(new URL(request.url).pathname));
  const actionScriptBytes = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry) => entry.initiatorType === "script")
    .reduce((sum, entry) => sum + entry.decodedBodySize, 0));
  const longTaskState = await page.evaluate(() => window.__utilityTestLongTasks ?? { supported: false, entries: [] });
  longTaskSupported = longTaskState.supported;
  longTasks.push(...longTaskState.entries);
  const rows = await page.locator("[data-library-row], .library-row, [data-smoke-row], table tbody tr").count();
  const initialSourceEntries = await Promise.all(initialScripts.map(async (file) => ({ file, sources: assetFiles.has(file) ? await sourceMapSources(file) : [] })));
  const forbiddenInitial = initialSourceEntries.filter(({ file, sources }) =>
    /worker(?!-client)|wasm/iu.test(file)
    || sources.some((source) => /(?:^|\/)src\/(?:generated\/(?:catalog|tool-loaders)|tools\/[^/]+\/module)\.ts$/u.test(source)),
  );
  const actionSourceEntries = await Promise.all(actionScripts.map(async (file) => ({ file, sources: assetFiles.has(file) ? await sourceMapSources(file) : [] })));
  const actionImplementations = actionSourceEntries.filter(({ sources }) => sources.some((source) => /(?:^|\/)src\/tools\/[^/]+\/module\.ts$/u.test(source)));
  const actionRequests = requests.filter((request) => request.resourceType !== "script");
  const externalRequests = actionRequests.filter((request) => !request.url.startsWith(origin));
  const nonGetRequests = actionRequests.filter((request) => request.method !== "GET");
  const meaningfulConsoleErrors = consoleErrors.filter((message) => !/favicon/iu.test(message));
  const failures = [];
  if (response?.status() !== 200) failures.push("root-route");
  if (rows > 50) failures.push("rows-over-50");
  if (forbiddenInitial.length > 0 || inlineForbiddenCatalog) failures.push("forbidden-initial-assets");
  if (externalRequests.length > 0 || nonGetRequests.length > 0) failures.push("network-boundary");
  if (longTaskSupported && longTasks.some((entry) => entry.duration > 50)) failures.push("long-task-over-50ms");
  if (meaningfulConsoleErrors.length > 0 || pageErrors.length > 0) failures.push("browser-errors");
  const receipt = {
    schemaVersion: 1,
    status: failures.length === 0 ? "PASS" : "FAIL",
    portableReceipt: "quality/receipts/test-html-smoke.json",
    page: "test.html",
    initial: {
      scripts: initialScripts,
      scriptBytes: initialScriptBytes,
       forbiddenAssets: forbiddenInitial.map(({ file }) => file),
       inlineForbiddenCatalog,

    },
    action: {
      scripts: actionScripts,
      scriptBytes: actionScriptBytes,
      newScriptBytes: Math.max(0, actionScriptBytes - initialScriptBytes),
      implementationAssets: actionImplementations.map(({ file }) => file),
    },
    rows,
    longTasks: { supported: longTaskSupported, maxDurationMs: longTasks.length === 0 ? 0 : Math.max(...longTasks.map((entry) => entry.duration)), thresholdMs: 50 },
    network: { externalRequests: externalRequests.length, nonGetRequests: nonGetRequests.length },
    consoleErrors: meaningfulConsoleErrors,
    pageErrors,
    failures,
  };
  lastReceipt = receipt;
  await writeReceipt(receipt);
  if (failures.length > 0) throw new Error(`test.html smoke failed: ${failures.join(", ")}`);
  console.log(`test.html smoke PASS: ${rows} row(s), ${initialScriptBytes} B initial JS, ${receipt.action.newScriptBytes} B action JS`);
} catch (error) {
  await writeReceipt(lastReceipt === null ? {
    schemaVersion: 1,
    status: "FAIL",
    portableReceipt: "quality/receipts/test-html-smoke.json",
    error: String(error),
  } : { ...lastReceipt, status: "FAIL", error: String(error) });
  throw error;
} finally {
  if (browser !== undefined) await browser.close().catch(() => undefined);
  server.kill("SIGTERM");
}
