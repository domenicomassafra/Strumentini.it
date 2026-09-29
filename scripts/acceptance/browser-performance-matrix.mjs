import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
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
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const evidenceRootFiles = new Set(["astro.config.mjs", "package-lock.json", "package.json", "tsconfig.json", "wrangler.jsonc"]);
const evidencePrefixes = ["public/", "quality/fixtures/", "quality/oracles/", "scripts/", "src/", "tests/"];

async function currentEvidenceSourceFingerprint() {
  const raw = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" });
  const paths = raw.split("\0")
    .filter(Boolean)
    .filter((path) => !path.startsWith("quality/receipts/") && (evidenceRootFiles.has(path) || evidencePrefixes.some((prefix) => path.startsWith(prefix))))
    .sort();
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(path);
    hash.update("\0");
    hash.update(await readFile(resolve(root, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
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
  for (const file of files.filter((entry) => entry.endsWith(".js.map"))) {
    const map = JSON.parse(await readFile(resolve(assetDir, file), "utf8"));
    const sources = Array.isArray(map.sources) ? map.sources : [];
    if (sources.some((source) => /(?:^|\/)src\/tools\/[^/]+\/module\.ts$/u.test(String(source)))) {
      implementationAssets.push(file.slice(0, -4));
    }
  }
  const page = await readFile(resolve(dist, "tools/business-day/index.html"), "utf8");
  const referenced = [...new Set(
    [...page.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.js[^"]*)"/gu)]
      .map((match) => basename(String(match[1]).split("?")[0])),
  )];
  const initialEngineReferences = engineChunks.filter((entry) => referenced.includes(entry.file)).map((entry) => entry.file);
  const eagerImplementationReferences = implementationAssets.filter((file) => referenced.includes(file));
  const baselinePath = resolve(root, "quality/receipts/build-baseline.json");
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const totalJsBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const totalGzipBytes = entries.reduce((sum, entry) => sum + entry.gzipBytes, 0);
  const initialEntries = entries.filter((entry) => referenced.includes(entry.file));
  const initialJsBytes = initialEntries.reduce((sum, entry) => sum + entry.bytes, 0);
  const initialGzipBytes = initialEntries.reduce((sum, entry) => sum + entry.gzipBytes, 0);
  // Older receipts predate explicit initial-route accounting. Their total JS size is a
  // conservative ceiling for the old initial route, so it is safe as a fallback: the
  // current initial payload must fit under that historical whole-build budget. The
  // aggregate size of every lazy tool chunk is intentionally not a shell regression
  // metric because catalog growth is allowed to add on-demand code.
  const baselineInitialJsBytes = typeof baseline.initialJsBytes === "number" ? baseline.initialJsBytes : baseline.totalJsBytes;
  const deltaBytes = initialJsBytes - baselineInitialJsBytes;
  const deltaPercent = baselineInitialJsBytes === 0 ? null : (deltaBytes / baselineInitialJsBytes) * 100;
  const initialRouteGate = initialEngineReferences.length === 0
    && eagerImplementationReferences.length === 0
    && deltaPercent !== null
    && deltaPercent <= 25
    ? "PASS"
    : "REGRESSION";
  const networkApiFiles = entries.filter((entry) => /fetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|new\s+EventSource/u.test(entry.text)).map((entry) => entry.file);
  return {
    page: "tools/business-day/index.html",
    jsAssetCount: entries.length,
    totalJsBytes,
    totalGzipBytes,
    engineChunks,
    implementationAssets: implementationAssets.sort(),
    initialScriptFiles: referenced,
    initialJsBytes,
    initialGzipBytes,
    initialEngineReferences,
    eagerImplementationReferences,
    lazyEngineGate: engineChunks.length > 0 && initialEngineReferences.length === 0 ? "PASS" : "FAIL",
    bundleBaseline: {
      source: "quality/receipts/build-baseline.json",
      metric: "initial-route-js",
      baselineMetric: typeof baseline.initialJsBytes === "number" ? "initialJsBytes" : "historical-total-js-ceiling",
      baselineJsAssetCount: baseline.jsAssetCount,
      baselineInitialJsBytes,
      currentInitialJsBytes: initialJsBytes,
      deltaBytes,
      deltaPercent,
      eagerImplementationReferences,
      gate: initialRouteGate,
    },
    workerAssets: files.filter((file) => /worker.*\.js$/u.test(file)),
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
    const failures = [];
    if (mobileToolOverflow) failures.push("tool-mobile-overflow");
    if (homeResponse?.status() !== 200 || homeMobileOverflow) failures.push("home-route-or-mobile");
    if (libraryResponse?.status() !== 200 || libraryRows < 1 || libraryMobileOverflow) failures.push("library-route-or-mobile");
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
      mobile: { width: 390, height: 844, toolOverflow: mobileToolOverflow, homeOverflow: homeMobileOverflow, libraryOverflow: libraryMobileOverflow },
      lazy: { initialScripts: beforeScripts.length, afterActionScripts: lazyScripts.length, engineChunkNames, observedEngineChunk: lazyScripts.filter((url) => engineChunkNames.includes(basename(new URL(url).pathname))).map((url) => basename(new URL(url).pathname)) },
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

// The matrix receipt is only trustworthy if every verdict inside it was observed in the
// same run. Sibling acceptance scripts are therefore executed here and their real exit
// status is recorded; an unrun or failing script is never reported as a historical PASS.
const SIBLING_ACCEPTANCE = [
  { command: "npm run acceptance:browser", script: "scripts/browser-acceptance.mjs" },
  { command: "npm run acceptance:onboarding", script: "scripts/acceptance-onboarding.mjs" },
  { command: "npm run acceptance:telemetry", script: "scripts/acceptance-telemetry.mjs" },
  { command: "node scripts/acceptance-text-research.mjs", script: "scripts/acceptance-text-research.mjs" },
  { command: "node scripts/acceptance-campaign-url.mjs", script: "scripts/acceptance-campaign-url.mjs" },
  { command: "node scripts/acceptance-client-time-math.mjs", script: "scripts/acceptance-client-time-math.mjs" },
  { command: "npm run acceptance:business-math", script: "scripts/acceptance-business-math.mjs" },
  { command: "npm run acceptance:developer-web", script: "scripts/acceptance-developer-web.mjs" },
  { command: "node scripts/acceptance-search-library.mjs", script: "scripts/acceptance-search-library.mjs" },
  { command: "node scripts/acceptance-table-handoff.mjs", script: "scripts/acceptance-table-handoff.mjs" },
  { command: "node scripts/acceptance-workbench.mjs", script: "scripts/acceptance-workbench.mjs" },
  { command: "node scripts/acceptance-file-hash.mjs", script: "scripts/acceptance-file-hash.mjs" },
];

async function runSiblingAcceptance() {
  const entries = [];
  for (const { command, script } of SIBLING_ACCEPTANCE) {
    const path = resolve(root, script);
    if (!existsSync(path)) {
      entries.push({ command, status: "NOT_RUN", evidence: `${script} does not exist` });
      continue;
    }
    const outcome = await new Promise((resolveOutcome) => {
      const child = spawn(process.execPath, [script], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      child.on("close", (code) => resolveOutcome({ code, output }));
      child.on("error", (error) => resolveOutcome({ code: null, output: String(error) }));
    });
    const summary = outcome.output.trim().split("\n").filter(Boolean).slice(-1)[0] ?? "";
    entries.push({
      command,
      status: outcome.code === 0 ? "PASS" : "FAIL",
      evidence: summary.length > 0 ? summary.slice(0, 300) : `exit ${outcome.code}`,
    });
  }
  return entries;
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { cwd: root, stdio: "ignore" });
try {
  await waitForServer();
  const sourceFingerprint = await currentEvidenceSourceFingerprint();
  const engineChunkNames = staticData.engineChunks.map((entry) => entry.file);
  const results = [];
  for (const definition of engineDefinitions) results.push(await runEngine(definition, engineChunkNames));
  const freshScriptResults = await runSiblingAcceptance();
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    sourceFingerprint,
    server: { origin, bind: "127.0.0.1", networkPolicy: "external requests aborted before transmission; synthetic task values never sent" },
    staticInspection: staticData,
    browserMatrix: {
      requestedEngines: results,
      declaredExternalMatrix: [
        { browser: "Safari desktop", status: "UNSUPPORTED", reason: "No local Safari executable; Playwright WebKit is not Safari" },
        { browser: "iOS Safari", status: "EXTERNAL_OR_UNAVAILABLE", reason: "No physical iOS device or simulator evidence in this local run" },
        { browser: "Android Chrome", status: "EXTERNAL_OR_UNAVAILABLE", reason: "No physical Android device or emulator evidence in this local run" },
      ],
    },
    freshAcceptance: [
      // Every entry below is observed in THIS run against THIS build. A script that was
      // not executed is reported as NOT_RUN rather than inheriting a historical verdict.
      { command: "npm run build", status: staticData.lazyEngineGate === "PASS" ? "PASS" : "FAIL", evidence: `lazyEngineGate=${staticData.lazyEngineGate}; ${staticData.jsAssetCount} JS assets; ${staticData.totalJsBytes} B total` },
      ...engineDefinitions.map((definition) => ({
        command: `node scripts/acceptance/browser-performance-matrix.mjs (${definition.name})`,
        status: results.find((result) => result.engine === definition.name)?.status ?? "NOT_RUN",
        evidence: `core/home/library routes, lazy engine chunk, network privacy, long-task gate observed in this run`,
      })),
      ...freshScriptResults,
    ],
  };
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "fresh-browser-matrix.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ report: resolve(receiptDir, "fresh-browser-matrix.json"), static: staticData, matrix: results.map((result) => ({ engine: result.engine, status: result.status, classification: result.classification, longTaskGate: result.longTasks?.gate, lazy: result.lazy?.observedEngineChunk })) }, null, 2));
} finally {
  server.kill("SIGTERM");
}
