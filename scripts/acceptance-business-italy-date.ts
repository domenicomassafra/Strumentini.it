import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { currentEvidenceSourceFingerprint } from "./lib/current-revision";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_BUSINESS_ITALY_DATE_PORT ?? 18204);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid port ${String(port)}`);
const origin = `http://127.0.0.1:${port}`;
const receiptRoot = resolve(root, "quality/receipts/business-italy-date");
const server = spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], {
  cwd: root,
  stdio: "ignore",
});
const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

interface BrowserCase {
  readonly id: string;
  readonly oracle: string;
  readonly setup?: (page: Page, form: Locator) => Promise<void>;
  readonly expect: RegExp;
  readonly additionallyExpect?: readonly RegExp[];
}

async function setValue(page: Page, id: string, value: string): Promise<void> {
  const control = page.locator(`#${id}`);
  await control.waitFor();
  const tag = await control.evaluate((element) => element.tagName);
  if (tag === "SELECT") await control.selectOption(value);
  else await control.fill(value);
}

const setupBusiness = (toolId: string, values: Readonly<Record<string, string>>) => async (page: Page) => {
  for (const [field, value] of Object.entries(values)) await setValue(page, `${toolId}-${field}`, value);
};

const cases: readonly BrowserCase[] = [
  { id: "scientific-calculator", oracle: "cand-204", setup: setupBusiness("scientific-calculator", { expression: "2 + 3 * 4" }), expect: /\b14\b/u },
  { id: "fraction-integer-toolkit", oracle: "cand-205", setup: setupBusiness("fraction-integer-toolkit", { mode: "fraction", left: "2/3", right: "5/7", operation: "add" }), expect: /29\/21/u },
  { id: "statistics-grade-calculator", oracle: "cand-206", setup: setupBusiness("statistics-grade-calculator", { mode: "descriptive", values: "1; 2; 2; 5" }), expect: /2[,.]5/u, additionallyExpect: [/2[,.]25000000/u] },
  { id: "interest-savings-calculator", oracle: "cand-207", setup: setupBusiness("interest-savings-calculator", { mode: "simple", principal: "1000", annualRatePercent: "5", years: "2" }), expect: /1[.\s]?100[,.]00/u },
  { id: "partita-iva-validator", oracle: "cand-208", setup: async (page) => setValue(page, "partita-iva-validator-value", "IT 12345678903"), expect: /Valido/u, additionallyExpect: [/12345678903/u, /Esistenza nel registro verificata[\s\S]*No/u] },
  { id: "iban-validator", oracle: "cand-209", setup: async (page) => setValue(page, "iban-validator-value", "IT60 X054 2811 1010 0000 0123 456"), expect: /Valido/u, additionallyExpect: [/05428/u, /Esistenza conto verificata[\s\S]*No/u] },
  { id: "basic-unit-converter", oracle: "cand-214", setup: setupBusiness("basic-unit-converter", { cssMode: "standard", value: "1.5", from: "meter", to: "centimeter" }), expect: /\b150\b/u },
  { id: "engineering-unit-converter", oracle: "cand-215", setup: setupBusiness("engineering-unit-converter", { value: "100", from: "kilometer-per-hour", to: "meter-per-second" }), expect: /27[,.]777/u },
  { id: "storage-download-calculator", oracle: "cand-216", setup: setupBusiness("storage-download-calculator", { mode: "storage", value: "1", from: "kilobyte", to: "byte" }), expect: /\b1000\b/u },
  { id: "battery-vehicle-power-helper", oracle: "cand-217", setup: setupBusiness("battery-vehicle-power-helper", { mode: "battery", direction: "mah-to-wh", value: "5000", voltage: "3.7" }), expect: /18[,.]5/u },
  { id: "reference-size-converter", oracle: "cand-218", setup: setupBusiness("reference-size-converter", { mode: "paper", paper: "A4", outputUnit: "millimeter" }), expect: /210\s*×\s*297\s*mm/u },
  { id: "mortgage-amortization-calculator", oracle: "cand-221", setup: setupBusiness("mortgage-amortization-calculator", { principal: "100000", annualRatePercent: "3", termMonths: "12" }), expect: /8[.\s]?469[,.]37/u, additionallyExpect: [/101[.\s]?632[,.]44/u] },
  { id: "geometry-equation-motion-helper", oracle: "cand-222", setup: setupBusiness("geometry-equation-motion-helper", { mode: "rectangle", width: "4", height: "3", lengthUnit: "meter" }), expect: /12(?:[,.]0+)?\s*m²/u, additionallyExpect: [/14(?:[,.]0+)?\s*m/u] },
  { id: "everyday-cost-calculator", oracle: "cand-223", setup: setupBusiness("everyday-cost-calculator", { mode: "unit-price", price: "4.50", quantity: "750", quantityUnit: "gram", normalizeUnit: "kilogram" }), expect: /6[,.]0000/u, additionallyExpect: [/0[,.]75\s*kg/u] },
  { id: "italian-document-expiry", oracle: "cand-240", setup: async (_page, form) => {
    const selects = form.locator("select");
    await selects.first().selectOption("passport");
    const dates = form.locator("input[type='date']");
    await dates.nth(0).fill("1990-08-20");
    await dates.nth(1).fill("2026-10-06");
  }, expect: /2036-10-06/u },
  { id: "inps-artigiani-commercianti", oracle: "cand-256", setup: async (page) => {
    await setValue(page, "inps-ac-income", "56224");
    await setValue(page, "inps-ac-profile", "artigiano");
    await setValue(page, "inps-ac-seniority", "before-1996");
  }, expect: /13[.\s]?501[,.]20\s*€/u, additionallyExpect: [/56[.\s]?224[,.]00\s*€/u] },
  { id: "gestione-separata-contributi", oracle: "cand-257", setup: async (page) => {
    await setValue(page, "gs-income", "10000");
    await setValue(page, "gs-profile", "professional-no-other-mandatory-pension-coverage");
  }, expect: /2[.\s]?607[,.]00\s*€/u, additionallyExpect: [/sotto la soglia/iu] },
  { id: "ponti-ferie-optimizer", oracle: "cand-258", setup: async (page) => setValue(page, "ponti-budget", "4"), expect: /4 giorni/u, additionallyExpect: [/2026-01-01\s*→\s*2026-01-04/u, /1 ferie/u] },
];

if (cases.length !== 18 || new Set(cases.map(({ id }) => id)).size !== 18) throw new Error(`business/Italy/date acceptance must contain exactly 18 unique tools; got ${cases.length}`);

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/tools/basic-unit-converter/`);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`acceptance server did not start: ${origin}`);
}

function expectedStaticFailure(url: string): boolean {
  try {
    return new URL(url).pathname === "/api/auth/session";
  } catch {
    return false;
  }
}

async function a11yAudit(form: Locator): Promise<string[]> {
  return form.locator("input, textarea, select, button").evaluateAll((controls) => controls.filter((control) => {
    const element = control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement;
    if (element instanceof HTMLInputElement && element.type === "hidden") return false;
    if (element instanceof HTMLButtonElement && (element.textContent ?? "").trim() !== "") return false;
    const id = element.getAttribute("id");
    return !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby") && element.closest("label") === null && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).map((control) => control.outerHTML.slice(0, 160)));
}

async function acceptTool(context: BrowserContext, testCase: BrowserCase) {
  const page = await context.newPage();
  const requests: Array<{ url: string; method: string; postData: string | null }> = [];
  const lazyScripts: string[] = [];
  const runtimeErrors: string[] = [];
  let started = false;
  page.on("request", (request) => {
    if (!started) return;
    requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    if (request.resourceType() === "script") lazyScripts.push(request.url());
  });
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error" || expectedStaticFailure(message.location().url)) return;
    runtimeErrors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on("requestfailed", (request) => {
    if (!expectedStaticFailure(request.url())) runtimeErrors.push(`request failed ${request.url()}`);
  });
  try {
    const response = await page.goto(`${origin}/tools/${testCase.id}/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`${testCase.id}: HTTP ${String(response?.status())}`);
    await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();
    // The P.IVA page also contains a separate tax simulation form after the validator.
    const form = testCase.id === "partita-iva-validator"
      ? page.locator("article[data-tool-page] form:has(#partita-iva-validator-value)")
      : page.locator("article[data-tool-page] form").last();
    await form.waitFor();
    if (testCase.setup !== undefined) await testCase.setup(page, form);
    const submit = form.locator("button[type='submit']").first();
    await submit.waitFor();
    started = true;
    await submit.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator(".result-panel[data-state='success']").last();
    await panel.waitFor({ timeout: 15_000 });
    const text = await panel.innerText();
    if (!testCase.expect.test(text)) throw new Error(`${testCase.id}: expected ${String(testCase.expect)} in ${JSON.stringify(text.slice(0, 1800))}`);
    for (const expectation of testCase.additionallyExpect ?? []) {
      if (!expectation.test(text)) throw new Error(`${testCase.id}: expected ${String(expectation)} in ${JSON.stringify(text.slice(0, 1800))}`);
    }
    if (await panel.locator("[data-result-primary-answer]").count() !== 1) throw new Error(`${testCase.id}: semantic primary answer missing or duplicated`);
    const oracleMarker = page.locator(`[data-oracle-entry="${testCase.oracle}"]`);
    const oracleMarkerCount = await oracleMarker.count();
    if ((testCase.id === "iban-validator" || testCase.id === "partita-iva-validator" || testCase.id.startsWith("inps-") || testCase.id === "gestione-separata-contributi" || testCase.id === "ponti-ferie-optimizer") && oracleMarkerCount < 1) {
      throw new Error(`${testCase.id}: rendered oracle provenance marker ${testCase.oracle} missing`);
    }
    if (runtimeErrors.length > 0) throw new Error(`${testCase.id}: runtime/console errors: ${runtimeErrors.join(" | ")}`);
    const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
    if (bad.length > 0) throw new Error(`${testCase.id}: external/non-GET/task-body request observed: ${JSON.stringify(bad)}`);
    if (lazyScripts.length === 0) throw new Error(`${testCase.id}: no post-submit implementation script observed`);
    const unlabeled = await a11yAudit(form);
    if (unlabeled.length > 0) throw new Error(`${testCase.id}: unlabeled controls: ${unlabeled.join(" | ")}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (horizontalOverflow) throw new Error(`${testCase.id}: horizontal overflow at 390px`);
    return {
      toolId: testCase.id,
      oracleEntryId: testCase.oracle,
      status: "PASS",
      semanticAssertion: testCase.expect.source,
      outputSha256: createHash("sha256").update(text).digest("hex"),
      taskRequestCount: requests.length,
      lazyScriptCount: lazyScripts.length,
      externalTaskRequests: 0,
      nonGetTaskRequests: 0,
      taskContentLeaks: 0,
      runtimeErrors: 0,
      horizontalOverflow: false,
      unlabeledControls: 0,
      oracleMarkerObserved: oracleMarkerCount > 0,
    };
  } finally {
    await page.close();
  }
}

try {
  await waitForServer();
  const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results: Awaited<ReturnType<typeof acceptTool>>[] = [];
  const failures: Array<{ toolId: string; error: string }> = [];
  try {
    for (const testCase of cases) {
      console.log(`accepting ${testCase.id}`);
      try {
        const result = await acceptTool(context, testCase);
        results.push(result);
        const perToolReceipt = {
          schemaVersion: 1,
          status: "PASS",
          checkedAt: new Date().toISOString(),
          sourceFingerprint,
          subjectToolId: result.toolId,
          oracleEntryId: result.oracleEntryId,
          keyboard: "submit exercised with Enter",
          accessibility: "all interactive controls in the exercised form have a label or accessible name",
          mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
          externalTaskRequests: 0,
          nonGetTaskRequests: 0,
          taskContentLeaks: 0,
          runtimeConsoleErrors: 0,
          network: "zero external, non-GET, or task-body requests after task start",
          implementationEager: false,
          lazyImplementationObserved: result.lazyScriptCount > 0,
          semanticEvidence: "fixture-aligned bounded input produced the asserted visible domain output",
          result,
        };
        await mkdir(resolve(receiptRoot, "browser"), { recursive: true });
        await writeFile(resolve(receiptRoot, "browser", `${result.toolId}.json`), `${JSON.stringify(perToolReceipt, null, 2)}\n`, "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ toolId: testCase.id, error: message });
        console.error(`browser BLOCKED: ${testCase.id}: ${message}`);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
  const scriptText = await readFile(new URL(import.meta.url), "utf8");
  const receipt = {
    schemaVersion: 1,
    status: failures.length === 0 ? "PASS" : "PARTIAL",
    checkedAt: new Date().toISOString(),
    sourceFingerprint,
    tools: cases.map(({ id }) => id),
    passedTools: results.map(({ toolId }) => toolId),
    blockedTools: failures,
    routesAttempted: cases.length,
    routesPassed: results.length,
    keyboard: "every submit action exercised with Enter",
    accessibility: "all interactive controls in each exercised form have a label or accessible name",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    runtimeConsoleErrors: 0,
    network: "zero external, non-GET, or task-body requests after task start",
    implementationEager: false,
    lazyImplementationObservedFor: results.filter(({ lazyScriptCount }) => lazyScriptCount > 0).map(({ toolId }) => toolId),
    semanticEvidence: "each route is submitted with a fixture-aligned bounded input and asserts visible domain output; focused engine tests own deeper boundary/refusal proofs",
    scriptSha256: createHash("sha256").update(scriptText).digest("hex"),
    results,
  };
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(resolve(receiptRoot, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`business/Italy/date browser acceptance: ${results.length}/${cases.length} PASS`);
  if (failures.length > 0) process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
