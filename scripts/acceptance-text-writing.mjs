import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18145;
const origin = `http://127.0.0.1:${port}`;
const cases = [
  { id: "word-character-line-counter", setup: async (page) => page.locator("form textarea").first().fill("uno due tre"), expect: /parole[\s\S]*3/iu },
  { id: "case-converter", setup: async (page) => page.locator("form textarea").first().fill("HELLO World"), expect: /hello world/u },
  { id: "whitespace-normalizer", setup: async (page) => page.locator("form textarea").first().fill("  alpha   beta  "), expect: /alpha beta/u },
  { id: "invisible-character-detector", setup: async (page) => page.locator("form textarea").first().fill("a\u200Bb"), expect: /\bab\b/u },
  { id: "unicode-normalizer", setup: async (page) => page.locator("form textarea").first().fill("e\u0301"), expect: /é/u },
  { id: "line-sorter", setup: async (page) => page.locator("form textarea").first().fill("zeta\nalpha"), expect: /alpha[\s\S]*zeta/u },
  { id: "line-deduplicator", setup: async (page) => page.locator("form textarea").first().fill("alpha\nalpha\nbeta"), expect: /alpha[\s\S]*beta/u },
  { id: "list-intersection", setup: async (page) => { const fields = page.locator("form textarea"); await fields.nth(0).fill("alpha\nbeta"); await fields.nth(1).fill("beta\ngamma"); }, expect: /beta/u },
  { id: "list-difference", setup: async (page) => { const fields = page.locator("form textarea"); await fields.nth(0).fill("alpha\nbeta"); await fields.nth(1).fill("beta"); }, expect: /alpha/u },
  { id: "find-replace-preview", setup: async (page) => { await page.locator("form textarea").first().fill("one one"); await page.getByLabel("Trova", { exact: true }).fill("one"); await page.getByLabel("Sostituisci con", { exact: true }).fill("two"); }, expect: /two two/u },
  { id: "markdown-preview", setup: async (page) => page.locator("form textarea").first().fill("# Safe"), expect: /Safe/u },
  { id: "markdown-table-formatter", setup: async (page) => page.locator("form textarea").first().fill("|a|b|\n|-|-|\n|one|two|"), expect: /one[\s\S]*two/u },
  { id: "slug-generator", setup: async (page) => page.locator("form textarea").first().fill("Café déjà vu"), expect: /cafe-deja-vu/u },
  { id: "text-to-csv-rows", setup: async (page) => page.locator("form textarea").first().fill("one,two\nthree,four"), expect: /column1,column2/u },
  { id: "csv-column-to-list", setup: async (page) => { await page.locator("form textarea").first().fill("name,note\nAda,\"hello, world\""); await page.getByLabel(/Nome colonna o posizione/iu).fill("note"); }, expect: /hello, world/u },
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

// The site shell asks the Worker for the current account session on every route.
// This acceptance server is a plain static file server, so that single endpoint
// answers 404 here by design. Every other failed response, and every console
// error, stays fatal. See scripts/acceptance-family-matrix.mjs for the same rule.
const staticOnlyFailurePaths = new Set(["/api/auth/session"]);
const isExpectedStaticFailure = (url) => {
  try {
    return staticOnlyFailurePaths.has(new URL(url).pathname);
  } catch {
    return false;
  }
};

async function acceptTool(context, testCase) {
  const page = await context.newPage();
  const requests = [];
  const scripts = [];
  const runtimeErrors = [];
  let started = false;
  page.on("request", (request) => {
    if (!started) return;
    requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push({ text: message.text(), url: message.location()?.url ?? "" }); });

  const response = await page.goto(`${origin}/tools/${testCase.id}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${testCase.id}: HTTP ${response?.status()}`);
  const form = page.locator("form").last();
  await form.waitFor();
  await testCase.setup(page);
  const submit = form.locator("button[type='submit']");
  await submit.waitFor();
  started = true;
  await submit.focus();
  await page.keyboard.press("Enter");
  const result = page.locator(".result-panel[data-state='success']");
  await result.waitFor({ timeout: 10000 });
  const output = await result.innerText();
  if (!testCase.expect.test(output)) throw new Error(`${testCase.id}: unexpected output ${JSON.stringify(output.slice(0, 500))}`);
  for (const actionId of ["copy", "download", "reset"]) {
    const action = result.locator(`[data-result-action="${actionId}"]`);
    if (await action.count() !== 1) throw new Error(`${testCase.id}: missing Result v2 ${actionId} action`);
    if (await action.getAttribute("type") !== "button") throw new Error(`${testCase.id}: ${actionId} action is not a keyboard button`);
  }
  if (await result.locator('[data-primary-action="true"][data-result-action="copy"]').count() !== 1) {
    throw new Error(`${testCase.id}: copy is not the explicit primary Result v2 action`);
  }
  // A console error is tolerated only when its own source URL is the optional
  // account probe; anything else is fatal.
  const consoleErrors = runtimeErrors.filter((entry) => !isExpectedStaticFailure(entry.url));
  if (consoleErrors.length > 0) throw new Error(`${testCase.id}: runtime/console error: ${consoleErrors.map((entry) => `${entry.text} (${entry.url})`).join(" | ")}`);
  if (scripts.length === 0) throw new Error(`${testCase.id}: no lazy implementation script observed after submit`);
  const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
  if (bad.length > 0) throw new Error(`${testCase.id}: external, non-GET, or task-body request observed`);

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${testCase.id}: horizontal overflow at 390px`);
  const unlabeled = await form.locator("input, textarea, select, button").evaluateAll((controls) => controls.filter((control) => {
    const element = control;
    if (element instanceof HTMLInputElement && element.type === "hidden") return false;
    if (element instanceof HTMLButtonElement && (element.textContent ?? "").trim() !== "") return false;
    const id = element.getAttribute("id");
    const labelledBy = element.getAttribute("aria-labelledby");
    const ariaLabel = element.getAttribute("aria-label");
    const wrappingLabel = element.closest("label");
    return !ariaLabel && !labelledBy && !wrappingLabel && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).map((control) => control.outerHTML.slice(0, 120)));
  if (unlabeled.length > 0) throw new Error(`${testCase.id}: unlabeled controls: ${unlabeled.join(" | ")}`);
  await page.close();
  return { toolId: testCase.id, lazyScriptCount: scripts.length, taskRequestCount: requests.length, horizontalOverflow: false, unlabeledControls: 0 };
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  for (const testCase of cases) results.push(await acceptTool(context, testCase));
  await context.close();
  await browser.close();
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tools: cases.map(({ id }) => id),
    routesChecked: results.length,
    keyboard: "every submit action exercised with Enter",
    accessibility: "all interactive controls in the tool form have a label or accessible name",
    resultV2Actions: "every route exposes copy/download/reset with copy as the explicit primary action",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    runtimeConsoleErrors: 0,
    network: "zero external, non-GET, or task-body requests after task start",
    implementationEager: false,
    lazyImplementationObservedFor: results.map((result) => result.toolId),
    results,
  };
  await mkdir(resolve(root, "quality/receipts/text-writing"), { recursive: true });
  await writeFile(resolve(root, "quality/receipts/text-writing/browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`text-writing browser acceptance PASS: ${results.length} tools, keyboard/mobile/a11y/locality/lazy-load observed`);
} finally {
  server.kill("SIGTERM");
}
