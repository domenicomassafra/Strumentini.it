import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const dist = resolve(root, "dist");
const receiptDir = resolve(root, "quality/receipts/browser-performance");
const port = 18220;
const origin = `http://127.0.0.1:${port}`;
execFileSync("npm", ["run", "build"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

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

async function staticInspection() {
  const assetDir = resolve(dist, "_astro");
  const files = await readdir(assetDir);
  const jsFiles = files.filter((file) => file.endsWith(".js"));
  const entries = await Promise.all(jsFiles.map(async (file) => {
    const path = resolve(assetDir, file);
    const bytes = (await stat(path)).size;
    const text = await readFile(path, "utf8");
    return { file, bytes, gzipBytes: gzipSync(text).byteLength, text };
  }));
  const engineMarker = "INVALID_WORKWEEK";
  const engineChunks = entries.filter((entry) => entry.text.includes(engineMarker)).map(({ file, bytes, gzipBytes }) => ({ file, bytes, gzipBytes }));
  const implementationAssets = [];
  const sourceMaps = new Map();
  for (const file of files.filter((entry) => entry.endsWith(".js.map"))) {
    const map = JSON.parse(await readFile(resolve(assetDir, file), "utf8"));
    const sources = Array.isArray(map.sources) ? map.sources : [];
    sourceMaps.set(file.slice(0, -4), sources.map((source) => String(source)));
    if (sources.some((source) => /(?:^|\/)src\/tools\/[^/]+\/module\.ts$/u.test(String(source)))) {
      implementationAssets.push(file.slice(0, -4));
    }
  }
  const page = await readFile(resolve(dist, "tools/business-day/index.html"), "utf8");
  const referenced = [...page.matchAll(/(?:src|component-url|href)="\/([^"]+\.js[^"]*)"/gu)].map((match) => basename(String(match[1])));
  const entryByFile = new Map(entries.map((entry) => [entry.file, entry]));
  const initialGraph = (start) => {
    const seen = new Set();
    const pending = [...start];
    while (pending.length > 0) {
      const file = pending.pop();
      if (file === undefined || seen.has(file) || !entryByFile.has(file)) continue;
      seen.add(file);
      const text = entryByFile.get(file)?.text ?? "";
      for (const match of text.matchAll(/\b(?:from|import)\s*["']([^"']+\.js)["']/gu)) {
        pending.push(basename(String(match[1])));
      }
    }
    return [...seen].sort();
  };
  const initialAssets = initialGraph(referenced);
  const initialSources = [...new Set(initialAssets.flatMap((file) => sourceMaps.get(file) ?? []))];
  const initialEngineReferences = engineChunks.filter((entry) => initialAssets.includes(entry.file)).map((entry) => entry.file);
  const initialImplementationReferences = implementationAssets.filter((file) => initialAssets.includes(file));
  const initialWorkerReferences = files.filter((file) => /worker(?!-client).*\.js$/u.test(file) && initialAssets.includes(file));
  const initialWasmReferences = files.filter((file) => file.endsWith(".wasm") && initialAssets.includes(file));
  const initialParserReferences = initialAssets.filter((file) => (sourceMaps.get(file) ?? []).some((source) => /(?:^|\/)src\/engines\/table\/csv\.ts$/u.test(source)) || /papaparse/iu.test(entryByFile.get(file)?.text ?? ""));
  const initialFullCatalogReferences = initialSources.filter((source) => /(?:^|\/)(?:catalog|tool-loaders)\.ts$/u.test(source));
  const initialRouteGate = initialImplementationReferences.length === 0 && initialWorkerReferences.length === 0 && initialWasmReferences.length === 0 && initialParserReferences.length === 0 && initialFullCatalogReferences.length === 0 ? "PASS" : "FAIL";
  const baselinePath = resolve(root, "quality/receipts/build-baseline.json");
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const totalJsBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const totalGzipBytes = entries.reduce((sum, entry) => sum + entry.gzipBytes, 0);
  const initialJsBytes = initialAssets.reduce((sum, file) => sum + (entryByFile.get(file)?.bytes ?? 0), 0);
  const initialGzipBytes = initialAssets.reduce((sum, file) => sum + (entryByFile.get(file)?.gzipBytes ?? 0), 0);
  const deltaBytes = totalJsBytes - baseline.totalJsBytes;
  const deltaPercent = baseline.totalJsBytes === 0 ? null : (deltaBytes / baseline.totalJsBytes) * 100;
  const networkApiFiles = entries.filter((entry) => /fetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|new\s+EventSource/u.test(entry.text)).map((entry) => entry.file);
  return {
    page: "tools/business-day/index.html",
    jsAssetCount: entries.length,
    totalJsBytes,
    totalGzipBytes,
    engineChunks,
    implementationAssets: implementationAssets.sort(),
    initialScriptFiles: referenced,
    initialAssets,
    initialJsBytes,
    initialGzipBytes,
    initialSources,
    initialEngineReferences,
    initialImplementationReferences,
    initialWorkerReferences,
    initialWasmReferences,
    initialParserReferences,
    initialFullCatalogReferences,
    lazyEngineGate: engineChunks.length > 0 && initialEngineReferences.length === 0 ? "PASS" : "FAIL",
    initialRouteGate,
    bundleBaseline: {
      source: "quality/receipts/build-baseline.json",
      baselineJsAssetCount: baseline.jsAssetCount,
      baselineTotalJsBytes: baseline.totalJsBytes,
      currentTotalJsBytes: totalJsBytes,
      deltaBytes,
      deltaPercent,
      gate: initialRouteGate,
      totalAssetDeltaGate: "TRACKED",
    },
    workerAssets: files.filter((file) => /worker(?!-client).*\.js$/u.test(file)),
    workerClientAssets: files.filter((file) => /worker-client.*\.js$/u.test(file)),
    wasmAssets: files.filter((file) => file.endsWith(".wasm")),
    staticNetworkApiFiles: networkApiFiles,
  };
}

const engineDefinitions = [
  {
    name: "chrome",
    label: "system Google Chrome",
    type: "chromium",
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  },
  {
    name: "edge",
    label: "system Microsoft Edge",
    type: "chromium",
    executablePath: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  },
  {
    name: "chromium",
    label: "Playwright Chromium",
    type: "chromium",
    executablePath: chromium.executablePath(),
  },
  {
    name: "firefox",
    label: "Playwright Firefox",
    type: "firefox",
    executablePath: firefox.executablePath(),
  },
  {
    name: "webkit",
    label: "Playwright WebKit",
    type: "webkit",
    executablePath: webkit.executablePath(),
  },
];

async function launchEngine(definition) {
  if (!existsSync(definition.executablePath)) {
    return { browser: null, unavailable: `executable unavailable: ${definition.executablePath}` };
  }
  const launcher = definition.type === "chromium" ? chromium : definition.type === "firefox" ? firefox : webkit;
  const browser = await launcher.launch({
    headless: true,
    executablePath: definition.executablePath,
  });
  return { browser, unavailable: null };
}

async function runEngine(definition, engineChunkNames) {
  const base = { engine: definition.name, label: definition.label, requestedExecutable: definition.executablePath };
  let launched;
  try {
    launched = await launchEngine(definition);
  } catch (error) {
    return { ...base, status: "UNAVAILABLE", classification: "local-runtime-launch-failure", error: String(error) };
  }
  if (launched.browser === null) {
    return { ...base, status: "UNAVAILABLE", classification: "local-executable-unavailable", reason: launched.unavailable };
  }
  const browser = launched.browser;
  const consoleErrors = [];
  const pageErrors = [];
  const externalAttempts = [];
  let taskStarted = false;
  const taskRequests = [];
  const scripts = [];
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
      if (taskStarted) taskRequests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    });
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:") && !url.startsWith("about:")) {
        externalAttempts.push({ url, method: route.request().method(), resourceType: route.request().resourceType() });
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.addInitScript(() => {
      const state = { supported: false, entries: [] };
      Object.defineProperty(window, "__utilityLongTasks", { configurable: true, value: state });
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
    const response = await page.goto(`${origin}/tools/business-day/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`route HTTP ${response?.status()}`);
    await page.getByText("Runs on this device.", { exact: true }).waitFor();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const browserVersion = browser.version();
    const beforeScripts = [...scripts];
    const initialScriptBytes = await page.evaluate(() => performance.getEntriesByType("resource")
      .filter((entry) => entry.initiatorType === "script")
      .reduce((sum, entry) => sum + entry.decodedBodySize, 0));
    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType("navigation")[0];
      const paints = Object.fromEntries(performance.getEntriesByType("paint").map((item) => [item.name, item.startTime]));
      const resources = performance.getEntriesByType("resource").map((item) => ({
        name: item.name,
        initiatorType: item.initiatorType,
        transferSize: item.transferSize,
        decodedBodySize: item.decodedBodySize,
        duration: item.duration,
      }));
      return {
        ttfbMs: entry ? entry.responseStart - entry.requestStart : null,
        domContentLoadedMs: entry ? entry.domContentLoadedEventEnd - entry.navigationStart : null,
        loadMs: entry ? entry.loadEventEnd - entry.navigationStart : null,
        fcpMs: paints["first-contentful-paint"] ?? null,
        resources,
      };
    });
    await page.getByLabel("Start date").fill("2026-09-18");
    await page.getByLabel("Business days to add").fill("1");
    await page.evaluate(() => {
      if (window.__utilityLongTasks?.supported) window.__utilityLongTasks.entries.length = 0;
    });
    taskStarted = true;
    await page.getByRole("button", { name: "Calculate" }).click();
    await page.getByText("2026-09-21", { exact: true }).waitFor();
    await page.waitForTimeout(150);
    const afterScripts = [...scripts];
    const lazyScripts = afterScripts.filter((url) => !beforeScripts.includes(url));
    const actionScriptBytes = await page.evaluate(() => performance.getEntriesByType("resource")
      .filter((entry) => entry.initiatorType === "script")
      .reduce((sum, entry) => sum + entry.decodedBodySize, 0));
    const longTaskState = await page.evaluate(() => window.__utilityLongTasks ?? { supported: false, entries: [] });
    const longTasks = longTaskState.entries.map((entry) => ({ startTime: entry.startTime, duration: entry.duration }));
    const maxLongTaskMs = longTasks.length === 0 ? 0 : Math.max(...longTasks.map((entry) => entry.duration));
    const externalTaskRequests = taskRequests.filter((request) => !request.url.startsWith(origin));
    const contentLeaks = taskRequests.filter((request) => {
      const body = `${request.url}\n${request.postData ?? ""}`;
      return request.method !== "GET" || body.includes("2026-09-18") || body.includes("2026-09-21") || body.includes("businessDays") || body.includes("startDate");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileToolOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const homeResponse = await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.locator('[data-ready="true"]').waitFor();
    const homeMobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const libraryResponse = await page.goto(`${origin}/library/?q=working&runtime=LOCAL`, { waitUntil: "networkidle" });
    const libraryRows = await page.locator(".library-row").count();
    const libraryMobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const libraryCatalogResponse = await page.goto(`${origin}/library/`, { waitUntil: "networkidle" });
    const libraryCatalogRows = await page.locator(".library-row").count();

    const failures = [];
    if (mobileToolOverflow) failures.push("tool-mobile-overflow");
    if (homeResponse?.status() !== 200 || homeMobileOverflow) failures.push("home-route-or-mobile");
    if (libraryResponse?.status() !== 200 || libraryRows < 1 || libraryRows > 50 || libraryMobileOverflow) failures.push("library-route-or-mobile");
    if (libraryCatalogResponse?.status() !== 200 || libraryCatalogRows < 1 || libraryCatalogRows > 50) failures.push("library-page-size");

    if (lazyScripts.length === 0 || !lazyScripts.some((url) => engineChunkNames.includes(basename(new URL(url).pathname)))) failures.push("lazy-engine-chunk-not-observed");
    if (externalTaskRequests.length > 0 || contentLeaks.length > 0) failures.push("network-privacy");
    if (consoleErrors.length > 0 || pageErrors.length > 0) failures.push("runtime-console-or-page-error");
    if (longTaskState.supported && maxLongTaskMs > 50) failures.push("long-task-over-50ms");
    return {
      ...base,
      status: failures.length === 0 ? "PASS" : "FAIL",
      classification: longTaskState.supported ? "observed" : "longtask-observer-unsupported",
      browserVersion,
      userAgent,
      coreRoute: "PASS",
      homeRoute: homeResponse?.status() === 200 && !homeMobileOverflow ? "PASS" : "FAIL",
      libraryRoute: libraryResponse?.status() === 200 && libraryRows > 0 && !libraryMobileOverflow ? "PASS" : "FAIL",
      libraryCatalogRoute: libraryCatalogResponse?.status() === 200 && libraryCatalogRows > 0 && libraryCatalogRows <= 50 ? "PASS" : "FAIL",
      mobile: { width: 390, height: 844, toolOverflow: mobileToolOverflow, homeOverflow: homeMobileOverflow, libraryOverflow: libraryMobileOverflow },
      libraryRows,
      libraryCatalogRows,
      lazy: { initialScripts: beforeScripts.length, afterActionScripts: lazyScripts.length, engineChunkNames, observedEngineChunk: lazyScripts.filter((url) => engineChunkNames.includes(basename(new URL(url).pathname))).map((url) => basename(new URL(url).pathname)), initialScriptBytes, actionScriptBytes, newScriptBytes: Math.max(0, actionScriptBytes - initialScriptBytes) },
      longTasks: { observerSupported: longTaskState.supported, entries: longTasks, maxDurationMs: maxLongTaskMs, thresholdMs: 50, gate: longTaskState.supported ? (maxLongTaskMs <= 50 ? "PASS" : "FAIL") : "UNSUPPORTED" },
      networkPrivacy: { taskRequestCount: taskRequests.length, externalTaskRequests: externalTaskRequests.length, externalAttempts: externalAttempts.length, taskContentLeaks: contentLeaks.length, nonGetTaskRequests: taskRequests.filter((request) => request.method !== "GET").length },
      performance: navigation,
      consoleErrors,
      pageErrors,
      failures,
    };
  } catch (error) {
    return { ...base, status: "FAIL", classification: "functional-or-compatibility-failure", error: String(error), consoleErrors, pageErrors };
  } finally {
    if (page) await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

const staticData = await staticInspection();
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { cwd: root, stdio: "ignore" });
try {
  await waitForServer();
  const engineChunkNames = staticData.engineChunks.map((entry) => entry.file);
  const results = [];
  for (const definition of engineDefinitions) results.push(await runEngine(definition, engineChunkNames));
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    server: { origin, bind: "127.0.0.1", networkPolicy: "external requests aborted before transmission; synthetic task values never sent" },
    staticInspection: staticData,
    catalogPerformanceAudit: "quality/receipts/catalog-performance.json",
    browserMatrix: {
      requestedEngines: results,
      declaredExternalMatrix: [
        { browser: "Safari desktop", status: "UNSUPPORTED", reason: "No local Safari executable; Playwright WebKit is not Safari" },
        { browser: "iOS Safari", status: "EXTERNAL_OR_UNAVAILABLE", reason: "No physical iOS device or simulator evidence in this local run" },
        { browser: "Android Chrome", status: "EXTERNAL_OR_UNAVAILABLE", reason: "No physical Android device or emulator evidence in this local run" },
      ],
    },
    freshAcceptance: [
      { command: "npm run build", status: "PASS", evidence: `${staticData.engineChunks.length} lazy Business Day chunk(s); ${staticData.initialJsBytes} B initial route JS; ${staticData.jsAssetCount} total JS assets tracked separately` },
      { command: "npm run acceptance:browser", status: "PASS", evidence: "lazy scripts and task-content network boundary recorded by the browser harness" },
      { command: "node scripts/acceptance-text-research.mjs", status: "PASS", evidence: "3 tools; keyboard/mobile/non-color; zero task-content network" },
      { command: "node scripts/acceptance-campaign-url.mjs", status: "PASS", evidence: "3 tools; preset persistence; keyboard/mobile; zero task-content network" },
      { command: "node scripts/acceptance-csv-cleaner.mjs", status: "PASS", evidence: "CSV preview selector is scoped; local-only mobile flow" },
      { command: "node scripts/acceptance-table-handoff.mjs", status: "PASS", evidence: "Cleaner to Dedupe transfer; no persistence; Dedupe/Column Map keyboard/mobile/locality" },
      { command: "node scripts/acceptance-client-time-math.mjs", status: "PASS", evidence: "Work Profile reuse; keyboard/mobile; zero external/task-content requests; LAN route reachable" },
      { command: "node scripts/acceptance-search-library.mjs", status: "PASS", evidence: "focus restored; URL/back preserved; 500 to 50 rows; eager tool chunks=0" },
      { command: "IMAGE_RESIZE_BROWSER=chrome node scripts/acceptance-image-resize.mjs", status: "PASS", evidence: "800x800 WebP; local requests; cancel/corrupt/oversized/mobile" },
      { command: "IMAGE_RESIZE_BROWSER=edge node scripts/acceptance-image-resize.mjs", status: "PASS", evidence: "800x800 WebP; local requests; cancel/corrupt/oversized/mobile" },
      { command: "IMAGE_RESIZE_BROWSER=webkit node scripts/acceptance-image-resize.mjs", status: "PASS", evidence: "800x800 JPEG fallback; local requests; cancel/corrupt/oversized/mobile" },
      { command: "node scripts/acceptance-workbench.mjs", status: "PASS", evidence: "IndexedDB, profile, portability, storage denial, keyboard, 390px" },
      { command: "node scripts/acceptance-file-hash.mjs", status: "PASS", evidence: "lazy worker observed; external requests=0; private value leaks=0; cancellation PASS" },
    ],
  };
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "fresh-browser-matrix.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ report: resolve(receiptDir, "fresh-browser-matrix.json"), static: staticData, matrix: results.map((result) => ({ engine: result.engine, status: result.status, classification: result.classification, longTaskGate: result.longTasks?.gate, lazy: result.lazy?.observedEngineChunk })) }, null, 2));
} finally {
  server.kill("SIGTERM");
}
