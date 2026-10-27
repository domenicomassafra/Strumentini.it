import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18143;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root,
  stdio: "ignore",
});
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const toolIds = [
  "effective-hourly-rate",
  "target-income-rate",
  "utilization-calculator",
  "capacity-planner",
  "retainer-capacity",
  "scope-creep-cost",
  "break-even",
  "payment-fee-gross-up",
  "late-payment-interest",
  "discount-impact",
  "proposal-budget-checker",
  "project-profitability",
  "invoice-number-generator",
  "invoice-math-validator",
  "percentage-helper",
  "currency-scenario",
];

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

async function acceptTool(context, toolId) {
  const page = await context.newPage();
  const route = `/tools/${toolId}`;
  let started = false;
  const taskRequests = [];
  const lazyScripts = [];
  page.on("request", (request) => {
    if (!started) return;
    const entry = { url: request.url(), method: request.method(), postData: request.postData() };
    taskRequests.push(entry);
    if (request.resourceType() === "script") lazyScripts.push(request.url());
  });
  const response = await page.goto(`${origin}${route}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${toolId}: HTTP ${response?.status()}`);
  await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();
  const submit = page.locator("[data-tool-run-control]");
  await submit.waitFor();
  started = true;
  await submit.focus();
  await page.keyboard.press("Enter");
  await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 10000 });
  await page.waitForTimeout(80);
  const violations = taskRequests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
  if (violations.length > 0) throw new Error(`${toolId}: external, non-GET, or task-body request observed`);
  if (lazyScripts.length === 0) throw new Error(`${toolId}: no lazy implementation script observed after submit`);
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${toolId}: horizontal overflow at 390px`);
  await page.close();
  return { toolId, taskRequestCount: taskRequests.length, lazyScriptCount: lazyScripts.length, horizontalOverflow: false };
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  for (const toolId of toolIds) results.push(await acceptTool(context, toolId));
  await context.close();
  await browser.close();
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tools: toolIds,
    routesChecked: results.length,
    keyboard: "every submit action exercised with Enter",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    network: "zero external, non-GET, or task-body requests after task start",
    implementationEager: false,
    lazyImplementationObservedFor: results.filter((result) => result.lazyScriptCount > 0).map((result) => result.toolId),
    results,
  };
  await mkdir(resolve(root, "quality/receipts/business-math"), { recursive: true });
  await writeFile(resolve(root, "quality/receipts/business-math/browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`business-math browser acceptance PASS: ${results.length} tools, keyboard/mobile/locality/lazy-load observed`);
} finally {
  server.kill("SIGTERM");
}
