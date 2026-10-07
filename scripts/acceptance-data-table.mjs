import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18147;
const origin = `http://127.0.0.1:${port}`;
const staticOnlyFailurePaths = new Set(["/api/auth/session"]);

function isExpectedStaticFailure(url) {
  try {
    return staticOnlyFailurePaths.has(new URL(url).pathname);
  } catch {
    return false;
  }
}

const fillPrimary = (text) => async (_page, form) => form.locator("textarea").first().fill(text);
const cases = [
  { id: "csv-viewer", setup: fillPrimary("a,b\n1,\"x,y\"\n2,3\n"), expect: /x,y/u },
  { id: "csv-delimiter-detector", setup: fillPrimary("a;b\n1;2\n3;4\n"), expect: /;|semicolon|punto e virgola/iu },
  { id: "csv-encoding-fixer", setup: fillPrimary("a,b\n1,2\n"), expect: /utf-8/iu },
  { id: "csv-column-selector", setup: async (_page, form) => { await form.locator("textarea").first().fill("a,b\n1,2\n"); await form.locator("input:not([type='file'])").first().fill("1,0"); }, expect: /b\s+a[\s\S]*2\s+1/u },
  { id: "csv-filter", setup: async (page, form) => { await form.locator("textarea").first().fill("name,score\nAda,10\nGrace,2\nAda,10\n"); await page.getByLabel("Valore", { exact: true }).fill("Ada"); }, expect: /Ada\s+10/u },
  { id: "csv-sort", setup: async (_page, form) => { await form.locator("textarea").first().fill("name,score\nAda,10\nGrace,2\nLinus,10\n"); await form.locator("input[type='number']").first().fill("1"); await form.locator("select").nth(1).selectOption("numeric"); }, expect: /Grace\s+2[\s\S]*Ada\s+10/u },
  { id: "csv-group-count", setup: fillPrimary("team,score\nA,1\nB,2\nA,3\n"), expect: /A\s+2/u },
  { id: "csv-join", setup: async (_page, form) => { const areas = form.locator("textarea"); await areas.nth(0).fill("id,name\n1,Ada\n2,Grace\n"); await areas.nth(1).fill("id,city\n1,London\n3,Paris\n"); }, expect: /London/u },
  { id: "csv-pivot-lite", setup: async (_page, form) => { await form.locator("textarea").first().fill("team,quarter,amount\nA,Q1,2\nA,Q2,3\nB,Q1,4\n"); const numbers = form.locator("input[type='number']"); await numbers.nth(0).fill("1"); await numbers.nth(1).fill("2"); await form.locator("select").last().selectOption("sum"); }, expect: /A\s+2\s+3/u },
  { id: "csv-to-json", setup: fillPrimary("a,a\n1,2\n"), expect: /a_2/u },
  { id: "json-to-csv", setup: async (_page, form) => { await form.locator("textarea").first().fill('[{"a":1},{"a":2,"b":3}]'); await form.locator("select").first().selectOption("union"); }, expect: /a\s+b[\s\S]*2\s+3/u },
  { id: "tsv-to-csv", setup: fillPrimary("a\tb\n1\t\"x\ty\"\n"), expect: /a\s+b/u },
  { id: "table-transpose", setup: fillPrimary("name,age\nAda,37\n"), expect: /field\s+name\s+age/u },
  { id: "missing-value-profiler", setup: fillPrimary("a,b\n1,\n,2\n"), expect: /valori mancanti: 2|valori_mancanti[\s\S]*2/iu },
  { id: "column-type-profiler", setup: fillPrimary("value\n1\ntrue\n2026-01-01\n"), expect: /mixed|misto/iu },
  { id: "duplicate-row-profiler", setup: fillPrimary("id,name\n1,Ada\n1,Ada\n2,Grace\n"), expect: /righe duplicate: 1|righe_duplicate[\s\S]*1/iu },
  { id: "quick-chart", setup: async (_page, form) => { await form.locator("textarea").first().fill("label,value\nA,2\nB & C,3\n"); const numbers = form.locator("input[type='number']"); await numbers.nth(1).fill("1"); await form.locator("select").first().selectOption("sum"); }, expect: /B & C/u },
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
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (isExpectedStaticFailure(message.location()?.url ?? "")) return;
    runtimeErrors.push(message.text());
  });
  const response = await page.goto(`${origin}/tools/${testCase.id}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${testCase.id}: HTTP ${response?.status()}`);
  const form = page.locator("form").last();
  await form.waitFor();
  await testCase.setup(page, form);
  const submit = form.locator("button[type='submit']");
  started = true;
  await submit.focus();
  await page.keyboard.press("Enter");
  const result = page.locator(".result-panel[data-state='success']");
  await result.waitFor({ timeout: 10000 });
  const output = await result.innerText();
  if (!testCase.expect.test(output)) throw new Error(`${testCase.id}: unexpected output ${JSON.stringify(output.slice(0, 900))}`);
  const resultV2 = result.locator('[data-result-class="table"]');
  await resultV2.waitFor();
  for (const slot of ["summary", "issue-counts", "table-preview"]) {
    if (await resultV2.locator(`[data-result-slot="${slot}"]`).count() !== 1) throw new Error(`${testCase.id}: Result v2 slot ${slot} missing or duplicated`);
  }
  for (const action of ["copy", "download", "reset"]) {
    if (await resultV2.locator(`[data-result-action="${action}"]`).count() !== 1) throw new Error(`${testCase.id}: truthful Result v2 action ${action} missing`);
  }
  if (runtimeErrors.length > 0) throw new Error(`${testCase.id}: runtime/console error: ${runtimeErrors.join(" | ")}`);
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

async function acceptResultV2EdgeCases(context) {
  const page = await context.newPage();
  const requests = [];
  const runtimeErrors = [];
  let started = false;
  page.on("request", (request) => {
    if (!started) return;
    requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (isExpectedStaticFailure(message.location()?.url ?? "")) return;
    runtimeErrors.push(message.text());
  });
  await page.goto(`${origin}/tools/csv-viewer/`, { waitUntil: "networkidle" });
  const form = page.locator("form").last();
  const textarea = form.locator("textarea").first();
  const submit = form.locator("button[type='submit']");
  started = true;

  const longCell = "L".repeat(700);
  const headers = Array.from({ length: 18 }, (_, index) => `col_${index}`);
  const rows = Array.from({ length: 40 }, (_, rowIndex) => headers.map((_header, columnIndex) =>
    rowIndex === 11 && columnIndex === 7 ? longCell : `r${rowIndex}c${columnIndex}`
  ));
  const wideLongCsv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  await textarea.fill(wideLongCsv);
  await submit.press("Enter");
  const result = page.locator(".result-panel[data-state='success']");
  await result.waitFor({ timeout: 10000 });
  await result.getByText("40 righe · 18 colonne", { exact: true }).waitFor();
  await result.getByText(/Anteprima: 30 di 40 righe tabella/u).waitFor();
  if (await result.getByText("r39c0", { exact: true }).count() !== 0) throw new Error("bounded preview rendered a row past the 30-row ceiling");
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) {
    throw new Error("csv-viewer Result v2 wide/long preview causes page overflow at 390px");
  }
  if (await result.getByText(longCell, { exact: true }).count() !== 1) throw new Error("long cell was not preserved in bounded preview");

  const downloadPromise = page.waitForEvent("download");
  await result.locator('[data-result-action="download"]').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (downloadPath === null) throw new Error("csv-viewer full download has no local browser path");
  const downloaded = await readFile(downloadPath, "utf8");
  if (!downloaded.includes("r39c0") || !downloaded.includes(longCell)) {
    throw new Error("bounded preview truncated the downloadable CSV artifact");
  }

  await textarea.fill("a,b\n");
  await submit.press("Enter");
  await result.getByText("0 righe · 2 colonne", { exact: true }).waitFor();
  await result.getByText(/Anteprima completa: 0 righe tabella/u).waitFor();

  await textarea.fill("a,b\n1,2,3\n2,4\n");
  await submit.press("Enter");
  await result.getByText("2 righe · 2 colonne", { exact: true }).waitFor();
  const warnings = result.locator('[data-result-slot="issue-counts"]');
  await warnings.getByText(/Riga 2:/u).waitFor();
  if (!/Avvisi\s*1/u.test(await warnings.innerText())) throw new Error("malformed/ragged fixture did not expose the warning count");

  await textarea.fill("id,name\n1,Ada\n2,Grace\n");
  await submit.press("Enter");
  await result.getByText("2 righe · 2 colonne", { exact: true }).waitFor();
  const handoffButton = result.locator('[data-result-action="handoff"]');
  await handoffButton.waitFor();
  const targetPromise = context.waitForEvent("page");
  await handoffButton.click();
  const target = await targetPromise;
  await target.waitForLoadState("networkidle");
  await target.getByText(/Tabella ricevuta · 2 righe/u).waitFor();
  if (target.url().includes("handoff=") || target.url().includes("1%2CAda") || target.url().includes("1,Ada")) {
    throw new Error("TableWorkbench handoff left token or payload in the target URL");
  }
  if (!/^http:\/\/127\.0\.0\.1:18147\/tools\/[a-z0-9-]+\/$/u.test(target.url())) {
    throw new Error(`TableWorkbench handoff opened an unexpected route: ${target.url()}`);
  }
  await target.close();

  if (runtimeErrors.length > 0) throw new Error(`Result v2 edge fixtures runtime/console error: ${runtimeErrors.join(" | ")}`);
  const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
  if (bad.length > 0) throw new Error("Result v2 edge fixtures observed external, non-GET, or task-body network requests");
  await page.close();
  return {
    wideLong390: "PASS",
    previewRowsShown: 30,
    previewRowsTotal: 40,
    fullDownloadPastPreview: "PASS",
    emptyTable: "PASS",
    malformedRaggedWarning: "PASS",
    sharedTableWorkbenchHandoff: "PASS",
    taskContentLeaks: 0,
  };
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  for (const testCase of cases) results.push(await acceptTool(context, testCase));
  const resultV2EdgeCases = await acceptResultV2EdgeCases(context);
  await context.close();
  await browser.close();
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tools: cases.map(({ id }) => id),
    routesChecked: results.length,
    keyboard: "every submit action exercised with Enter",
    accessibility: "all interactive controls in the tool form have a label or accessible name",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    runtimeConsoleErrors: 0,
    network: "zero external, non-GET, or task-body requests after task start",
    implementationEager: false,
    lazyImplementationObservedFor: results.map((result) => result.toolId),
    resultV2EdgeCases,
    results,
  };
  await mkdir(resolve(root, "quality/receipts/data-table"), { recursive: true });
  await writeFile(resolve(root, "quality/receipts/data-table/browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`data-table browser acceptance PASS: ${results.length} tools, keyboard/mobile/a11y/locality/lazy-load observed`);
} finally {
  server.kill("SIGTERM");
}
