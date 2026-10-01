import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18144;
const origin = `http://127.0.0.1:${port}`;
const toolIds = [
  "json-formatter", "yaml-formatter", "toml-formatter", "json-yaml-converter", "url-codec",
  "html-entity-codec", "base64-codec", "jwt-inspector", "uuid-generator", "hash-generator",
  "hmac-generator", "regex-tester", "cron-explainer", "cron-next-run", "unix-timestamp",
  "http-status-reference", "mime-type-lookup", "user-agent-parser", "query-string-editor", "json-path-playground",
];
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
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

async function acceptTool(context, toolId) {
  const page = await context.newPage();
  let started = false;
  const requests = [];
  const scripts = [];
  page.on("request", (request) => {
    if (!started) return;
    requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  const response = await page.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${toolId}: HTTP ${response?.status()}`);
  await page.getByText("Elaborazione sul dispositivo.", { exact: true }).waitFor();
  const submit = page.locator("form button[type='submit']");
  await submit.waitFor();
  started = true;
  await submit.focus();
  await page.keyboard.press("Enter");
  await page.locator(".gutter[data-state='success']").waitFor({ timeout: 10000 });
  await page.locator("pre.developer-result-json").waitFor({ timeout: 10000 });
  await page.waitForTimeout(80);
  if (scripts.length === 0) throw new Error(`${toolId}: no lazy implementation script observed after submit`);
  const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
  if (bad.length > 0) throw new Error(`${toolId}: external, non-GET, or task-body request observed`);
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${toolId}: horizontal overflow at 390px`);
  await page.close();
  return { toolId, lazyScriptCount: scripts.length, taskRequestCount: requests.length, horizontalOverflow: false };
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
    lazyImplementationObservedFor: results.map((result) => result.toolId),
    results,
  };
  await mkdir(resolve(root, "quality/receipts/developer-web"), { recursive: true });
  await writeFile(resolve(root, "quality/receipts/developer-web/browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`developer-web browser acceptance PASS: ${results.length} tools, keyboard/mobile/locality/lazy-load observed`);
} finally {
  server.kill("SIGTERM");
}
