import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const tempRoot = await mkdtemp(join(tmpdir(), "strumentini-result-perf-"));
const isolatedDist = resolve(tempRoot, "dist");
await cp(dist, isolatedDist, { recursive: true });
const receiptPath = resolve(root, "quality/receipts/result-v2/performance-current.json");
const baselinePath = resolve(root, "quality/baselines/result-v2-performance.json");
const writeBaseline = process.argv.includes("--write-baseline");
const port = 18600 + (process.pid % 200);
const origin = "http://127.0.0.1:" + String(port);
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", isolatedDist], {
  cwd: root,
  stdio: "ignore",
});
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
  throw new Error("performance server did not start");
}

async function assetBytes(url) {
  const path = new URL(url).pathname;
  if (!path.startsWith("/_astro/")) return 0;
  try {
    return (await stat(resolve(isolatedDist, path.slice(1)))).size;
  } catch {
    return 0;
  }
}

async function scenario(page, definition) {
  const requests = [];
  const scripts = [];
  let taskStarted = false;
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
    if (taskStarted) requests.push({
      url: request.url(),
      method: request.method(),
      postData: request.postData(),
      resourceType: request.resourceType(),
    });
  });
  await page.addInitScript(() => {
    const state = { supported: false, entries: [] };
    Object.defineProperty(window, "__resultPerfLongTasks", { configurable: true, value: state });
    try {
      if (typeof PerformanceObserver !== "undefined"
        && Array.isArray(PerformanceObserver.supportedEntryTypes)
        && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
        state.supported = true;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) state.entries.push({ startTime: entry.startTime, duration: entry.duration });
        });
        observer.observe({ type: "longtask", buffered: true });
      }
    } catch {
    }
  });

  const response = await page.goto(origin + definition.route, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(definition.name + ": HTTP " + String(response?.status()));
  await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();
  const initialScripts = [...new Set(scripts)];
  const initialJsBytes = (await Promise.all(initialScripts.map(assetBytes))).reduce((sum, value) => sum + value, 0);
  const initialWasm = performanceEntries(await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      transferSize: entry.transferSize,
      decodedBodySize: entry.decodedBodySize,
    })),
  )).filter((entry) => entry.name.endsWith(".wasm"));

  if (definition.prepare !== undefined) await definition.prepare(page);
  await page.evaluate(() => {
    if (window.__resultPerfLongTasks?.supported) window.__resultPerfLongTasks.entries.length = 0;
  });
  taskStarted = true;
  const startedAt = performance.now();
  await definition.run(page);
  const actionMs = performance.now() - startedAt;
  await page.waitForTimeout(80);
  const longTaskState = await page.evaluate(() => window.__resultPerfLongTasks ?? { supported: false, entries: [] });
  const maxLongTaskMs = longTaskState.entries.length === 0
    ? 0
    : Math.max(...longTaskState.entries.map((entry) => entry.duration));
  const afterScripts = [...new Set(scripts)];
  const lazyScripts = afterScripts.filter((url) => !initialScripts.includes(url));
  const lazyJsBytes = (await Promise.all(lazyScripts.map(assetBytes))).reduce((sum, value) => sum + value, 0);
  let boundedPreview = null;
  if (definition.maxPreviewLines !== undefined) {
    const preview = page.locator(".bounded-result-preview");
    if (await preview.count() !== 1) throw new Error(definition.name + ": expected one bounded result preview");
    const summary = await preview.getByRole("status").innerText();
    const match = summary.match(/^Anteprima:\s+(\d+)\s+di\s+(\d+)\s+righe\./u);
    if (match === null) throw new Error(definition.name + ": large result is not explicitly marked as a truncated preview");
    const shown = Number(match[1]);
    const total = Number(match[2]);
    const previewText = await preview.locator("pre").innerText();
    const renderedLines = previewText === "" ? 0 : previewText.split(/\r\n|\n|\r/u).length;
    if (shown > definition.maxPreviewLines || renderedLines > definition.maxPreviewLines || total <= shown) {
      throw new Error(definition.name + ": bounded preview exceeded its deterministic line budget");
    }
    boundedPreview = {
      maxLines: definition.maxPreviewLines,
      shown,
      total,
      renderedLines,
      truncated: true,
    };
  }
  const badRequests = requests.filter((request) =>
    !request.url.startsWith(origin)
    || request.method !== "GET"
    || (request.postData ?? "") !== "",
  );

  return {
    name: definition.name,
    resultClass: definition.resultClass,
    route: definition.route,
    initialScripts: initialScripts.map((url) => basename(new URL(url).pathname)),
    initialJsBytes,
    lazyScripts: lazyScripts.map((url) => basename(new URL(url).pathname)),
    lazyJsBytes,
    boundedPreview,
    initialWasmRequests: initialWasm.map((entry) => entry.name),
    actionMs,
    longTasks: {
      observerSupported: longTaskState.supported,
      count: longTaskState.entries.length,
      maxDurationMs: maxLongTaskMs,
    },
    taskRequests: requests.length,
    badTaskRequests: badRequests,
  };
}

function performanceEntries(value) {
  return Array.isArray(value) ? value : [];
}

const definitions = [
  {
    name: "light-calculator",
    resultClass: "calculator",
    route: "/tools/business-day/",
    prepare: async (page) => {
      await page.getByLabel(/^Data iniziale/u).fill("2026-09-18");
      await page.getByLabel(/^Giorni lavorativi da aggiungere/u).fill("1");
    },
    run: async (page) => {
      await page.getByRole("button", { name: "Calcola", exact: true }).click();
      await page.getByText("2026-09-21", { exact: true }).waitFor();
    },
  },
  {
    name: "large-text-output",
    resultClass: "text-code",
    route: "/tools/json-formatter/",
    maxPreviewLines: 80,
    prepare: async (page) => {
      const payload = JSON.stringify({
        rows: Array.from({ length: 1500 }, (_, index) => ({ index, text: "risultato-" + String(index) })),
      });
      await page.locator("form textarea").first().fill(payload);
    },
    run: async (page) => {
      await page.locator("form button[type='submit']").click();
      await page.locator(".gutter[data-state='success'], .result-panel[data-state='success']").first().waitFor();
    },
  },
  {
    name: "file-output",
    resultClass: "file",
    route: "/tools/file-hash/",
    prepare: async (page) => {
      const buffer = Buffer.alloc(1024 * 1024, 0x41);
      await page.locator("form").getByLabel("File").setInputFiles({
        name: "performance-private.bin",
        mimeType: "application/octet-stream",
        buffer,
      });
    },
    run: async (page) => {
      await page.getByRole("button", { name: "Calcola SHA-256" }).click();
      await page.locator(".result-panel[data-state='success']").waitFor();
    },
  },
];

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const definition of definitions) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      results.push(await scenario(page, definition));
      await page.close();
    }

    const heavyReceiptPath = resolve(root, "quality/benchmarks/heavy-local-runtime/controlled-runtime.json");
    const heavyControlled = JSON.parse(await readFile(heavyReceiptPath, "utf8").catch(() => "null"));
    const baseline = JSON.parse(await readFile(baselinePath, "utf8").catch(() => "null"));
    const failures = [];
    for (const result of results) {
      if (result.initialWasmRequests.length > 0) failures.push(result.name + ": eager WASM");
      if (result.badTaskRequests.length > 0) failures.push(result.name + ": unexpected task network");
      const budget = baseline?.scenarios?.[result.name];
      if (budget === undefined) {
        failures.push(result.name + ": missing deterministic baseline budget");
        continue;
      }
      result.budget = budget;
      if (result.initialJsBytes > budget.maxInitialJsBytes) {
        failures.push(result.name + ": initial JS " + String(result.initialJsBytes) + " > " + String(budget.maxInitialJsBytes));
      }
      if (result.lazyJsBytes > budget.maxLazyJsBytes) {
        failures.push(result.name + ": lazy JS " + String(result.lazyJsBytes) + " > " + String(budget.maxLazyJsBytes));
      }
      if (result.actionMs > budget.maxActionMs) {
        failures.push(result.name + ": action " + result.actionMs.toFixed(1) + "ms > " + String(budget.maxActionMs));
      }
      if (
        result.longTasks.observerSupported
        && result.longTasks.maxDurationMs > budget.maxLongTaskMs
      ) {
        failures.push(
          result.name + ": long task " + String(result.longTasks.maxDurationMs)
          + "ms > " + String(budget.maxLongTaskMs) + "ms",
        );
      }
    }

    const receipt = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      status: failures.length === 0 ? "PASS" : "FAIL",
      scenarios: results,
      deterministicBudgetSource: {
        schemaVersion: baseline?.schemaVersion ?? null,
        requiredScenarios: definitions.map((definition) => definition.name),
        invariant: baseline?.invariant ?? null,
      },
      heavyControlled,
      failures,
    };
    await mkdir(dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

    if (writeBaseline) {
      const scenarios = Object.fromEntries(results.map((result) => [
        result.name,
        {
          maxInitialJsBytes: Math.max(result.initialJsBytes + 1024, Math.ceil(result.initialJsBytes * 1.25)),
          maxLazyJsBytes: Math.max(result.lazyJsBytes + 1024, Math.ceil(result.lazyJsBytes * 1.25)),
          maxActionMs: Math.max(1000, Math.ceil(result.actionMs * 2)),
          maxLongTaskMs: Math.max(50, Math.ceil(result.longTasks.maxDurationMs * 1.5) + 10),
        },
      ]));
      await mkdir(dirname(baselinePath), { recursive: true });
      await writeFile(baselinePath, JSON.stringify({
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        scenarios,
        invariant: "No eager WASM and no non-GET/external task request; JS/action/long-task ceilings are versioned from the measured baseline.",
      }, null, 2) + "\n", "utf8");
    }

    if (failures.length > 0) throw new Error("Result v2 performance regression:\n- " + failures.join("\n- "));
    console.log("result-v2 performance baseline PASS:", results.map((result) =>
      result.name + "=" + String(result.initialJsBytes) + "B/" + result.actionMs.toFixed(1) + "ms",
    ).join(", "));
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
  await rm(tempRoot, { recursive: true, force: true });
}
